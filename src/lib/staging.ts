import "server-only";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { getSettingsMap } from "@/lib/db";

/** Fast local disk while downloading; files move to ReadySHARE when complete. */
export function getStagingPath(torrentId: string) {
  return path.join(process.cwd(), "data", "staging", torrentId);
}

export function ensureStagingPath(torrentId: string) {
  const dir = getStagingPath(torrentId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Persist .torrent sidecars on the Mac, not on ReadySHARE. */
export function getTorrentSidecarPath(torrentId: string) {
  return path.join(process.cwd(), "data", "torrents", `${torrentId}.torrent`);
}

export function writeTorrentSidecar(torrentId: string, buffer: Buffer) {
  const filePath = getTorrentSidecarPath(torrentId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function readTorrentSidecar(torrentId: string): Buffer | null {
  const local = getTorrentSidecarPath(torrentId);
  if (fs.existsSync(local)) return fs.readFileSync(local);

  // Legacy: older builds stored sidecars on the NAS download root.
  try {
    const legacy = path.join(
      getSettingsMap().downloadRoot,
      ".torrents",
      `${torrentId}.torrent`,
    );
    if (!fs.existsSync(legacy)) return null;
    const buf = fs.readFileSync(legacy);
    writeTorrentSidecar(torrentId, buf);
    try {
      fs.rmSync(legacy, { force: true });
    } catch {
      // ignore
    }
    return buf;
  } catch {
    return null;
  }
}

export function removeTorrentSidecar(torrentId: string) {
  const local = getTorrentSidecarPath(torrentId);
  if (fs.existsSync(local)) fs.rmSync(local, { force: true });
  try {
    const legacy = path.join(
      getSettingsMap().downloadRoot,
      ".torrents",
      `${torrentId}.torrent`,
    );
    if (fs.existsSync(legacy)) fs.rmSync(legacy, { force: true });
  } catch {
    // ignore
  }
}

export type PromoteProgress = {
  /** Bytes already at the destination (copied or renamed). */
  bytes: number;
  /** Total payload size under staging. */
  total: number;
};

function pathByteSize(target: string): number {
  const stat = fs.statSync(target);
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;

  let total = 0;
  const stack = [target];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // skip
        }
      }
    }
  }
  return total;
}

/** Total bytes waiting under a torrent's staging directory. */
export function stagingByteSize(torrentId: string): number {
  const staging = getStagingPath(torrentId);
  if (!fs.existsSync(staging)) return 0;
  return pathByteSize(staging);
}

async function movePath(
  from: string,
  to: string,
  onBytes: (n: number) => void,
): Promise<void> {
  const stat = await fs.promises.stat(from);
  if (stat.isDirectory()) {
    await fs.promises.mkdir(to, { recursive: true });
    const names = await fs.promises.readdir(from);
    for (const name of names) {
      await movePath(path.join(from, name), path.join(to, name), onBytes);
    }
    await fs.promises.rmdir(from);
    return;
  }

  await fs.promises.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.promises.rename(from, to);
    onBytes(stat.size);
    return;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code !== "EXDEV") throw error;
  }

  // Cross-device (local SSD → ReadySHARE): stream so we can report progress.
  const read = fs.createReadStream(from);
  const write = fs.createWriteStream(to);
  const maxBps = Number(process.env.LOCAL_BAY_PROMOTE_MAX_BPS || 0);
  let windowStart = Date.now();
  let windowBytes = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      onBytes(chunk.length);
      if (!(maxBps > 0)) {
        cb(null, chunk);
        return;
      }
      windowBytes += chunk.length;
      const elapsed = Date.now() - windowStart;
      const allowed = (maxBps * Math.max(elapsed, 1)) / 1000;
      if (windowBytes <= allowed) {
        cb(null, chunk);
        return;
      }
      const waitMs = Math.ceil(((windowBytes - allowed) * 1000) / maxBps);
      if (elapsed > 1000) {
        windowStart = Date.now();
        windowBytes = chunk.length;
      }
      setTimeout(() => cb(null, chunk), Math.min(waitMs, 250));
    },
  });
  try {
    await pipeline(read, counter, write);
  } catch (error) {
    try {
      await fs.promises.unlink(to);
    } catch {
      // ignore partial cleanup failure
    }
    throw error;
  }
  await fs.promises.unlink(from);
}

/**
 * Move completed payload from local staging to the category folder on ReadySHARE.
 * Same-disk renames finish instantly; cross-device copies report byte progress.
 */
export async function promoteStagingToSavePath(
  torrentId: string,
  finalDir: string,
  onProgress?: (progress: PromoteProgress) => void,
): Promise<string | null> {
  const staging = getStagingPath(torrentId);
  if (!fs.existsSync(staging)) return null;

  await fs.promises.mkdir(finalDir, { recursive: true });
  const entries = await fs.promises.readdir(staging, { withFileTypes: true });
  if (entries.length === 0) return null;

  const total = pathByteSize(staging);
  let bytes = 0;
  const report = (delta: number) => {
    bytes += delta;
    onProgress?.({ bytes: Math.min(bytes, total), total });
  };
  onProgress?.({ bytes: 0, total });

  let primary: string | null = null;
  for (const entry of entries) {
    const from = path.join(staging, entry.name);
    const to = path.join(finalDir, entry.name);
    await movePath(from, to, report);
    if (!primary) primary = to;
  }

  try {
    await fs.promises.rmdir(staging);
  } catch {
    await fs.promises.rm(staging, { recursive: true, force: true });
  }

  onProgress?.({ bytes: total, total });
  return primary;
}

export function removeStaging(torrentId: string) {
  const staging = getStagingPath(torrentId);
  if (fs.existsSync(staging)) {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/** Pull an existing partial from ReadySHARE into staging once (legacy downloads). */
export function seedStagingFromSavePath(
  torrentId: string,
  finalDir: string,
  name: string,
) {
  const staging = ensureStagingPath(torrentId);
  if (fs.readdirSync(staging).length > 0) return;

  const candidate = path.join(finalDir, name);
  if (!name || !fs.existsSync(candidate)) return;

  const dest = path.join(staging, path.basename(candidate));
  try {
    // Sync path is fine for the rare legacy reseed case.
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      fs.cpSync(candidate, dest, { recursive: true });
      fs.rmSync(candidate, { recursive: true, force: true });
    } else {
      try {
        fs.renameSync(candidate, dest);
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (code !== "EXDEV") throw error;
        fs.copyFileSync(candidate, dest);
        fs.unlinkSync(candidate);
      }
    }
  } catch (error) {
    console.warn(
      `[staging ${torrentId}] could not seed from save path:`,
      error instanceof Error ? error.message : error,
    );
  }
}
