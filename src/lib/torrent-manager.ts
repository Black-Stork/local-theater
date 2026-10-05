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
import type { TorrentView } from "@/lib/types";

type WebTorrentCtor = typeof WebTorrent;
type TorrentInstance = InstanceType<WebTorrentCtor>;

type GlobalTorrent = {
  __localTorrentManager?: TorrentManager;
};

export type { TorrentView };

class TorrentManager {
  private client: InstanceType<WebTorrentCtor> | null = null;
  private initPromise: Promise<void> | null = null;
  private live = new Map<string, TorrentInstance>();
  private timers = new Map<string, NodeJS.Timeout>();

  private async ensureClient() {
    if (this.client) return this.client;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const { default: WebTorrentClient } = await import("webtorrent");
        const settings = getSettingsMap();
        const uploadLimit = Number(settings.uploadLimit ?? "0");
        this.client = new WebTorrentClient({
          uploadLimit: Number.isFinite(uploadLimit) ? uploadLimit : 0,
        });
      })();
    }
    await this.initPromise;
    if (!this.client) throw new Error("Failed to start WebTorrent client");
    return this.client;
  }

  async applyUploadLimit(bytesPerSec: number) {
    const client = await this.ensureClient();
    client.throttleUpload(bytesPerSec);
  }

  list(): TorrentView[] {
    const categories = new Map(listCategories().map((c) => [c.id, c.name]));
    return listTorrents().map((torrent) => ({
      ...torrent,
      categoryName: categories.get(torrent.categoryId) ?? "Unknown",
    }));
  }

  get(id: string): TorrentView | null {
    return this.list().find((t) => t.id === id) ?? null;
  }

  private wireTorrent(id: string, torrent: TorrentInstance) {
    this.live.set(id, torrent);

    const sync = () => {
      const done = torrent.progress >= 1;
      updateTorrent(id, {
        name: torrent.name || "Torrent",
        infoHash: torrent.infoHash ? String(torrent.infoHash) : null,
        progress: torrent.progress ?? 0,
        downloadSpeed: torrent.downloadSpeed ?? 0,
        uploadSpeed: torrent.uploadSpeed ?? 0,
        downloaded: torrent.downloaded ?? 0,
        total: torrent.length ?? 0,
        peers: torrent.numPeers ?? 0,
        status: done ? "done" : "downloading",
        error: null,
      });
    };

    sync();
    const timer = setInterval(sync, 1000);
    this.timers.set(id, timer);

    torrent.on("done", () => {
      sync();
      updateTorrent(id, {
        status: "done",
        progress: 1,
        downloadSpeed: 0,
      });
    });

    torrent.on("error", (...args: unknown[]) => {
      const err = args[0];
      const message = err instanceof Error ? err.message : "Torrent error";
      updateTorrent(id, { status: "error", error: message });
    });

    torrent.on("warning", (...args: unknown[]) => {
      const warn = args[0];
      if (warn instanceof Error) {
        console.warn(`[torrent ${id}]`, warn.message);
      }
    });
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
      const uploadLimit = Number(settings.uploadLimit ?? "0");
      client.throttleUpload(Number.isFinite(uploadLimit) ? uploadLimit : 0);

      const torrent = client.add(opts.buffer, { path: savePath });
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
      const uploadLimit = Number(settings.uploadLimit ?? "0");
      client.throttleUpload(Number.isFinite(uploadLimit) ? uploadLimit : 0);

      const torrent = client.add(magnet, { path: savePath });
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

  async remove(id: string, deleteFiles = false) {
    const row = getTorrentById(id);
    if (!row) return;

    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }

    const live = this.live.get(id);
    if (live) {
      await new Promise<void>((resolve) => {
        live.destroy({ destroyStore: deleteFiles }, () => resolve());
      });
      this.live.delete(id);
    } else if (row.infoHash && this.client) {
      await new Promise<void>((resolve) => {
        this.client!.remove(
          row.infoHash!,
          { destroyStore: deleteFiles },
          () => resolve(),
        );
      });
    }

    deleteTorrent(id);
  }
}

export function getTorrentManager() {
  const g = globalThis as GlobalTorrent;
  if (!g.__localTorrentManager) {
    g.__localTorrentManager = new TorrentManager();
  }
  return g.__localTorrentManager;
}
