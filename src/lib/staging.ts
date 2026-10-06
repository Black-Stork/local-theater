import "server-only";
import fs from "node:fs";
import path from "node:path";
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

function movePath(from: string, to: string) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      movePath(path.join(from, name), path.join(to, name));
    }
    fs.rmdirSync(from);
    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code !== "EXDEV") throw error;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

/** Move completed payload from local staging to the category folder on ReadySHARE. */
export function promoteStagingToSavePath(
  torrentId: string,
  finalDir: string,
): string | null {
  const staging = getStagingPath(torrentId);
  if (!fs.existsSync(staging)) return null;

  fs.mkdirSync(finalDir, { recursive: true });
  const entries = fs.readdirSync(staging, { withFileTypes: true });
  if (entries.length === 0) return null;

  let primary: string | null = null;
  for (const entry of entries) {
    const from = path.join(staging, entry.name);
    const to = path.join(finalDir, entry.name);
    movePath(from, to);
    if (!primary) primary = to;
  }

  try {
    fs.rmdirSync(staging);
  } catch {
    fs.rmSync(staging, { recursive: true, force: true });
  }

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
    movePath(candidate, dest);
  } catch (error) {
    console.warn(
      `[staging ${torrentId}] could not seed from save path:`,
      error instanceof Error ? error.message : error,
    );
  }
}
