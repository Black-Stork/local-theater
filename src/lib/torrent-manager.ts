import "server-only";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type WebTorrent from "webtorrent";
import {
  deleteTorrent,
  getCategoryById,
  getSettingsMap,
  getTorrentById,
  getTorrentByInfoHash,
  insertTorrent,
  listCategories,
  listTorrents,
  updateTorrent,
} from "@/lib/db";
import {
  ANNOUNCE_INTERVAL_MS,
  ANNOUNCE_NUMWANT,
  FALLBACK_ANNOUNCE,
  isBenignTorrentWarning,
  mergeSwarmStats,
  readConnectedPeers,
  type ConnectedPeerView,
  type SwarmStats,
} from "@/lib/torrent-peers";
import {
  ensureStagingPath,
  getStagingPath,
  promoteStagingToSavePath,
  readTorrentSidecar,
  removeStaging,
  removeTorrentSidecar,
  seedStagingFromSavePath,
  writeTorrentSidecar,
} from "@/lib/staging";
import { resolveSpeedLimits } from "@/lib/speeds";
import type { TorrentView } from "@/lib/types";

type WebTorrentCtor = typeof WebTorrent;
type TorrentInstance = import("webtorrent").Torrent;
type LiveTorrent = TorrentInstance & {
  discovery?: {
    tracker?: {
      on: (event: string, cb: (data: TrackerUpdate) => void) => void;
      __localBaySwarmHook?: boolean;
    };
  };
};

type TrackerUpdate = {
  complete?: number;
  incomplete?: number;
};

type GlobalTorrent = {
  __localTorrentManager?: TorrentManager;
};

export type { TorrentView };

class TorrentManager {
  private client: InstanceType<WebTorrentCtor> | null = null;
  private initPromise: Promise<void> | null = null;
  private live = new Map<string, TorrentInstance>();
  private timers = new Map<string, NodeJS.Timeout>();
  private swarmStats = new Map<string, SwarmStats>();
  private peerSnapshots = new Map<string, ConnectedPeerView[]>();
  private lastProgressAt = new Map<string, number>();
  private lastDownloadedBytes = new Map<string, number>();
  private lastDiscoveryKickAt = new Map<string, number>();
  private reconnecting = new Set<string>();
  private finishing = new Set<string>();

  private async ensureClient() {
    if (this.client) return this.client;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const { default: WebTorrentClient } = await import("webtorrent");
        const limits = resolveSpeedLimits();
        this.client = new WebTorrentClient({
          uploadLimit: limits.uploadLimit,
          downloadLimit: limits.downloadLimit,
          // qBittorrent-style: many parallel connections + fixed listen port for NAT.
          maxConns: 200,
          torrentPort: 6881,
          dhtPort: 6881,
          dht: true,
          tracker: {
            getAnnounceOpts: () => ({ numwant: ANNOUNCE_NUMWANT }),
          },
          lsd: true,
          utPex: true,
          natUpnp: "permanent",
          natPmp: true,
          webSeeds: true,
          seedOutgoingConnections: true,
          secure: 1,
          // uTP often connects then stalls on home routers; TCP matches qBittorrent.
          utp: false,
        });
      })();
    }
    await this.initPromise;
    if (!this.client) throw new Error("Failed to start WebTorrent client");
    return this.client;
  }

  async applySpeedLimits() {
    const client = await this.ensureClient();
    const limits = resolveSpeedLimits();
    client.throttleUpload(limits.uploadLimit);
    client.throttleDownload(limits.downloadLimit);
  }

  async applyUploadLimit(bytesPerSec: number) {
    const client = await this.ensureClient();
    client.throttleUpload(bytesPerSec);
  }

  list(): TorrentView[] {
    const categories = new Map(listCategories().map((c) => [c.id, c.name]));
    return listTorrents().map((torrent) => {
      const live = this.live.has(torrent.id);
      // Finished, imported and paused items are detached from the swarm, so
      // there is no peer or tracker data to report for them.
      const inSwarm =
        live ||
        torrent.status === "downloading" ||
        torrent.status === "queued";
      const swarm = inSwarm ? this.swarmStats.get(torrent.id) : undefined;
      const connectedPeers = inSwarm
        ? (this.peerSnapshots.get(torrent.id) ?? [])
        : [];
      const peers = !inSwarm
        ? 0
        : live
          ? connectedPeers.length
          : connectedPeers.length || torrent.peers;
      const stagingPath =
        inSwarm || torrent.status === "paused"
          ? getStagingPath(torrent.id)
          : null;
      return {
        ...torrent,
        peers,
        categoryName: categories.get(torrent.categoryId) ?? "Unknown",
        swarmSeeds: swarm?.seeds ?? null,
        swarmLeechers: swarm?.leechers ?? null,
        connectedPeers,
        stagingPath,
      };
    });
  }

  get(id: string): TorrentView | null {
    return this.list().find((t) => t.id === id) ?? null;
  }

  private wireTorrent(id: string, torrent: TorrentInstance) {
    const wired = torrent as TorrentInstance & { __localBayWiredFor?: string };
    if (wired.__localBayWiredFor === id) {
      this.live.set(id, torrent);
      return;
    }
    wired.__localBayWiredFor = id;

    this.live.set(id, torrent);
    this.attachSwarmStatsListener(id, torrent);

    const sync = () => {
      if (!this.live.has(id)) return;
      const row = getTorrentById(id);
      if (!row || row.status === "paused") return;

      // `done` only flips once every piece is verified and written to disk;
      // `progress` hits 1 earlier, while the last piece is still in flight.
      if (torrent.done) {
        this.scheduleFinish(id, torrent);
        return;
      }

      const connectedPeers = readConnectedPeers(torrent);
      this.peerSnapshots.set(id, connectedPeers);
      const downloadSpeed = torrent.downloadSpeed ?? 0;
      const downloaded = torrent.downloaded ?? 0;
      const prevBytes = this.lastDownloadedBytes.get(id);
      if (prevBytes === undefined || downloaded > prevBytes) {
        this.lastDownloadedBytes.set(id, downloaded);
        this.lastProgressAt.set(id, Date.now());
      }

      updateTorrent(id, {
        name: torrent.name || "Torrent",
        infoHash: torrent.infoHash ? String(torrent.infoHash) : null,
        progress: torrent.progress ?? 0,
        downloadSpeed,
        uploadSpeed: torrent.uploadSpeed ?? 0,
        downloaded,
        total: torrent.length ?? 0,
        peers: connectedPeers.length,
        status: "downloading",
        error: null,
      });

      const stalledMs = Date.now() - (this.lastProgressAt.get(id) ?? Date.now());
      if (downloadSpeed < 8_192) {
        const lastKick = this.lastDiscoveryKickAt.get(id) ?? 0;
        if (Date.now() - lastKick > 45_000) {
          this.lastDiscoveryKickAt.set(id, Date.now());
          torrent.resume();
          this.kickDiscovery(torrent);
        }
      }

      // Full reconnect is expensive — only when truly stuck (no byte progress).
      // Longer grace when peers are connected (choked / hashing / verifying).
      const reconnectAfterMs =
        connectedPeers.length > 0 ? 4 * 60_000 : 2 * 60_000;
      if (stalledMs > reconnectAfterMs && !this.reconnecting.has(id)) {
        this.lastProgressAt.set(id, Date.now());
        void this.reconnectDownload(id);
      }
    };

    sync();
    const existing = this.timers.get(id);
    if (existing) clearInterval(existing);
    const timer = setInterval(sync, 1000);
    this.timers.set(id, timer);

    torrent.on("done", () => {
      this.scheduleFinish(id, torrent);
    });

    torrent.on("error", (...args: unknown[]) => {
      if (!this.live.has(id)) return;
      const err = args[0];
      const message = err instanceof Error ? err.message : "Torrent error";
      updateTorrent(id, { status: "error", error: message });
    });

    torrent.on("warning", (...args: unknown[]) => {
      const warn = args[0];
      const message =
        warn instanceof Error
          ? warn.message
          : typeof warn === "string"
            ? warn
            : "";
      if (message && !isBenignTorrentWarning(message)) {
        console.warn(`[torrent ${id}]`, message);
      }
    });

    torrent.on("noPeers", () => {
      this.kickDiscovery(torrent);
    });

    torrent.on("ready", () => {
      this.tuneDiscovery(torrent);
    });
    // Metadata may already be ready when wiring a resumed torrent.
    queueMicrotask(() => this.tuneDiscovery(torrent));
  }

  /**
   * Deferred so the caller finishes first: a torrent that is already complete
   * when it is wired would otherwise be marked done before the add/start that
   * wired it writes its own "downloading" row.
   */
  private scheduleFinish(id: string, torrent: TorrentInstance) {
    queueMicrotask(() => void this.finishDownload(id, torrent));
  }

  /**
   * The payload is complete: move it to its category folder, write the final
   * row, then leave the swarm. Nothing is polled or announced afterwards — a
   * finished item is just a file on disk.
   */
  private async finishDownload(id: string, torrent: TorrentInstance) {
    if (!this.live.has(id) || this.finishing.has(id)) return;
    this.finishing.add(id);

    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    this.live.delete(id);

    try {
      const row = getTorrentById(id);
      if (row) {
        try {
          promoteStagingToSavePath(id, row.savePath);
        } catch (error) {
          console.error(
            `[torrent ${id}] promote to save path failed:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      const total = torrent.length || row?.total || 0;
      updateTorrent(id, {
        name: torrent.name || row?.name || "Torrent",
        infoHash: torrent.infoHash
          ? String(torrent.infoHash)
          : (row?.infoHash ?? null),
        status: "done",
        progress: 1,
        downloadSpeed: 0,
        uploadSpeed: 0,
        downloaded: total || (torrent.downloaded ?? 0),
        total,
        peers: 0,
        error: null,
      });

      this.peerSnapshots.delete(id);
      this.swarmStats.delete(id);
      this.lastProgressAt.delete(id);
      this.lastDownloadedBytes.delete(id);
      this.lastDiscoveryKickAt.delete(id);

      if (!torrent.destroyed) {
        await destroyWithTimeout(torrent, false);
      }
    } finally {
      this.finishing.delete(id);
    }
  }

  private tuneDiscovery(torrent: TorrentInstance) {
    const discovery = (torrent as LiveTorrent).discovery as
      | {
          tracker?: {
            setInterval?: (ms: number) => void;
            update?: (opts?: object) => void;
          };
          _intervalMs?: number;
        }
      | undefined;
    if (!discovery) return;
    try {
      discovery._intervalMs = ANNOUNCE_INTERVAL_MS;
      discovery.tracker?.setInterval?.(ANNOUNCE_INTERVAL_MS);
      discovery.tracker?.update?.({ numwant: ANNOUNCE_NUMWANT });
    } catch {
      // ignore
    }
  }

  private kickDiscovery(torrent: TorrentInstance) {
    const discovery = (torrent as LiveTorrent).discovery as
      | {
          _dhtAnnounce?: () => void;
          tracker?: { update?: (opts?: object) => void };
        }
      | undefined;
    try {
      discovery?._dhtAnnounce?.();
      // Do not call tracker.start() here — it sends repeated "started" events.
      discovery?.tracker?.update?.({ numwant: ANNOUNCE_NUMWANT });
    } catch {
      // ignore discovery kick failures
    }
  }

  private attachSwarmStatsListener(id: string, torrent: TorrentInstance) {
    const attach = () => {
      const tracker = (torrent as LiveTorrent).discovery?.tracker;
      if (!tracker || tracker.__localBaySwarmHook) return;
      tracker.__localBaySwarmHook = true;
      tracker.on("update", (data: TrackerUpdate) => {
        if (
          typeof data.complete !== "number" &&
          typeof data.incomplete !== "number"
        ) {
          return;
        }
        this.swarmStats.set(
          id,
          mergeSwarmStats(this.swarmStats.get(id), data),
        );
      });
    };

    attach();
    torrent.on("trackerAnnounce", attach);
  }

  private addOpts(torrentId: string, _finalSavePath: string) {
    const path = ensureStagingPath(torrentId);
    return {
      path,
      announce: [...FALLBACK_ANNOUNCE],
      // WebTorrent defaults to sequential; rarest uses all peers in parallel.
      strategy: "rarest" as const,
      storeCacheSlots: 100,
      maxWebConns: 12,
      noPeersIntervalTime: 20,
      uploads: -1,
    };
  }

  async addFromFile(opts: {
    buffer: Buffer;
    categoryId: string;
    magnet?: string;
  }) {
    const category = getCategoryById(opts.categoryId);
    if (!category) throw new Error("Category not found");

    const settings = getSettingsMap();
    const savePath = path.join(settings.downloadRoot, category.name);
    fs.mkdirSync(savePath, { recursive: true });

    let parsedName = "Torrent";
    let infoHash: string | null = null;
    try {
      const parseTorrent = (await import("parse-torrent")).default;
      const parsed = await parseTorrent(opts.buffer);
      parsedName =
        typeof parsed.name === "string" && parsed.name
          ? parsed.name
          : parsedName;
      if (typeof parsed.infoHash === "string" && parsed.infoHash) {
        infoHash = parsed.infoHash;
      }
    } catch {
      // WebTorrent will validate the file
    }

    if (infoHash && getTorrentByInfoHash(infoHash)) {
      throw new Error("This torrent is already in the queue");
    }

    const id = uuid();
    writeTorrentSidecar(id, opts.buffer);

    insertTorrent({
      id,
      name: parsedName,
      infoHash,
      categoryId: category.id,
      status: "queued",
      savePath,
      magnet: opts.magnet ?? null,
    });

    try {
      const client = await this.ensureClient();
      await this.applySpeedLimits();
      seedStagingFromSavePath(id, savePath, parsedName);

      const torrent = client.add(opts.buffer, this.addOpts(id, savePath));
      this.wireTorrent(id, torrent);
      updateTorrent(id, { status: "downloading" });
    } catch (error) {
      try {
        removeTorrentSidecar(id);
      } catch {
        // ignore cleanup failure
      }
      const message =
        error instanceof Error ? error.message : "Failed to start download";
      updateTorrent(id, { status: "error", error: message });
      throw error;
    }

    return this.get(id)!;
  }

  async addFromMagnet(opts: { magnet: string; categoryId: string }) {
    const magnet = opts.magnet.trim();
    if (!magnet.startsWith("magnet:")) {
      throw new Error("Invalid magnet link");
    }

    const category = getCategoryById(opts.categoryId);
    if (!category) throw new Error("Category not found");

    const settings = getSettingsMap();
    const savePath = path.join(settings.downloadRoot, category.name);
    fs.mkdirSync(savePath, { recursive: true });

    const id = uuid();
    insertTorrent({
      id,
      name: "Resolving magnet…",
      infoHash: null,
      categoryId: category.id,
      status: "queued",
      savePath,
      magnet,
    });

    try {
      const client = await this.ensureClient();
      await this.applySpeedLimits();

      const torrent = client.add(magnet, this.addOpts(id, savePath));
      this.wireTorrent(id, torrent);
      updateTorrent(id, { status: "downloading" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start download";
      updateTorrent(id, { status: "error", error: message });
      throw error;
    }

    return this.get(id)!;
  }

  async stop(id: string) {
    const row = getTorrentById(id);
    if (!row) throw new Error("Not found");
    if (row.status === "done" || row.status === "imported") {
      throw new Error("Finished items cannot be stopped");
    }

    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }

    // Mark paused first so sync/done handlers don't flip status back.
    updateTorrent(id, {
      status: "paused",
      downloadSpeed: 0,
      uploadSpeed: 0,
      peers: 0,
      error: null,
    });
    this.peerSnapshots.set(id, []);

    const live = this.live.get(id);
    if (live) {
      // Keep downloaded bytes on disk; only detach from the swarm.
      await destroyWithTimeout(live, false);
      this.live.delete(id);
    } else if (row.infoHash && this.client) {
      await removeClientTorrentWithTimeout(this.client, row.infoHash, false);
    }

    return this.get(id)!;
  }

  async start(id: string) {
    const row = getTorrentById(id);
    if (!row) throw new Error("Not found");
    if (row.status === "done" || row.status === "imported") {
      throw new Error("Finished items cannot be started");
    }

    const existingLive = this.live.get(id);
    if (
      existingLive &&
      !existingLive.destroyed &&
      row.status === "downloading"
    ) {
      return this.get(id)!;
    }
    if (existingLive?.destroyed) {
      this.live.delete(id);
    }

    const live = this.live.get(id);
    if (live && !live.destroyed) {
      live.resume();
      updateTorrent(id, { status: "downloading", error: null });
      return this.get(id)!;
    }

    const client = await this.ensureClient();
    await this.applySpeedLimits();

    const infoHash =
      row.infoHash ??
      (existingLive?.infoHash ? String(existingLive.infoHash) : null);
    if (infoHash) {
      const existing = (await client.get(infoHash)) as TorrentInstance | null;
      if (existing && !existing.destroyed) {
        this.wireTorrent(id, existing);
        existing.resume();
        updateTorrent(id, { status: "downloading", error: null });
        return this.get(id)!;
      }
    }

    let source: Buffer | string | null = readTorrentSidecar(id);
    if (!source && row.magnet) {
      source = row.magnet;
    } else if (!source && row.infoHash) {
      source = `magnet:?xt=urn:btih:${row.infoHash}`;
    }

    if (!source) {
      throw new Error("No .torrent or magnet available to resume");
    }

    fs.mkdirSync(row.savePath, { recursive: true });
    seedStagingFromSavePath(id, row.savePath, row.name);
    const torrent = client.add(source, this.addOpts(id, row.savePath));
    this.wireTorrent(id, torrent);
    updateTorrent(id, { status: "downloading", error: null });
    return this.get(id)!;
  }

  /** Detach and rejoin swarm without deleting partial files. */
  private async reconnectDownload(id: string) {
    if (this.reconnecting.has(id)) return;
    this.reconnecting.add(id);
    this.lastProgressAt.set(id, Date.now());

    try {
      const row = getTorrentById(id);
      if (!row || row.status === "paused" || row.status === "done") return;

      console.log(`[torrent ${id}] stalled with no peers — reconnecting`);

      const timer = this.timers.get(id);
      if (timer) {
        clearInterval(timer);
        this.timers.delete(id);
      }

      const live = this.live.get(id);
      const infoHash =
        row.infoHash ?? (live?.infoHash ? String(live.infoHash) : null);

      if (live && !live.destroyed) {
        await destroyWithTimeout(live, false);
      }
      this.live.delete(id);
      this.peerSnapshots.set(id, []);

      const client = await this.ensureClient();
      if (infoHash) {
        await removeClientTorrentWithTimeout(client, infoHash, false);
      }

      await this.start(id);
    } catch (error) {
      console.warn(
        `[torrent ${id}] reconnect failed:`,
        error instanceof Error ? error.message : error,
      );
    } finally {
      this.reconnecting.delete(id);
    }
  }

  async remove(id: string, deleteFiles = true) {
    const row = getTorrentById(id);
    if (!row) return;

    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }

    const live = this.live.get(id);
    if (live) {
      await destroyWithTimeout(live, deleteFiles);
      this.live.delete(id);
    } else if (row.infoHash && this.client) {
      await removeClientTorrentWithTimeout(
        this.client,
        row.infoHash,
        deleteFiles,
      );
    }

    if (deleteFiles) {
      removeDownloadArtifacts(row.savePath, row.name);
    }
    removeStaging(id);

    // Always drop the persisted .torrent sidecar for this queue id.
    removeTorrentSidecar(id);
    this.swarmStats.delete(id);
    this.peerSnapshots.delete(id);

    deleteTorrent(id);
  }
}

function destroyWithTimeout(
  torrent: TorrentInstance,
  deleteFiles: boolean,
  ms = 8_000,
) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    try {
      torrent.destroy({ destroyStore: deleteFiles }, () => {
        clearTimeout(timer);
        finish();
      });
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

function removeClientTorrentWithTimeout(
  client: InstanceType<WebTorrentCtor>,
  infoHash: string,
  deleteFiles: boolean,
  ms = 8_000,
) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const settle = () => {
      clearTimeout(timer);
      finish();
    };
    try {
      // `remove()` rejects when the client no longer tracks this infoHash,
      // which is the normal case for a torrent that already left the swarm.
      const result = client.remove(
        infoHash,
        { destroyStore: deleteFiles },
        settle,
      ) as Promise<void> | void;
      if (result && typeof result.catch === "function") {
        result.catch(settle);
      }
    } catch {
      settle();
    }
  });
}

/** Delete the downloaded content (and a sibling .torrent if present). Never removes the category folder. */
function removeDownloadArtifacts(savePath: string, name: string) {
  const targets = new Set<string>();
  const contentPath = path.join(savePath, name);
  targets.add(contentPath);

  // Imported items sometimes store the file path itself in savePath.
  if (path.basename(savePath) === name) {
    targets.add(savePath);
  }

  const torrentSibling = path.join(
    path.dirname(contentPath),
    `${name}.torrent`,
  );
  targets.add(torrentSibling);
  targets.add(path.join(savePath, `${name}.torrent`));

  // Common WebTorrent / incomplete leftovers next to the content.
  for (const suffix of [".parts", ".!ut", ".!qb", ".part"]) {
    targets.add(`${contentPath}${suffix}`);
  }

  for (const target of targets) {
    // Never wipe the category download root (e.g. .../Movies).
    if (
      path.resolve(target) === path.resolve(savePath) &&
      path.basename(savePath) !== name
    ) {
      continue;
    }
    try {
      if (!fs.existsSync(target)) continue;
      fs.rmSync(target, { recursive: true, force: true });
    } catch (error) {
      console.error(
        "[torrent] failed to delete",
        target,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export function getTorrentManager() {
  const g = globalThis as GlobalTorrent;
  if (!g.__localTorrentManager) {
    g.__localTorrentManager = new TorrentManager();
  }
  return g.__localTorrentManager;
}
