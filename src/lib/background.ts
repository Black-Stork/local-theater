import "server-only";
import { listTorrents } from "@/lib/db";
import { startScanCron } from "@/lib/scan-cron";
import { getTorrentManager } from "@/lib/torrent-manager";

type BootGlobal = {
  __localTorrentBootstrapped?: boolean;
};

/** Idempotent boot for Node-only background jobs. */
export function ensureBackgroundJobs() {
  startScanCron();

  const boot = globalThis as BootGlobal;
  if (boot.__localTorrentBootstrapped) return;
  boot.__localTorrentBootstrapped = true;
  void bootstrapTorrentRuntime();
}

async function bootstrapTorrentRuntime() {
  const manager = getTorrentManager();
  try {
    await manager.applySpeedLimits();
  } catch (error) {
    console.warn(
      "[local-torrent] speed limits:",
      error instanceof Error ? error.message : error,
    );
  }

  for (const row of listTorrents()) {
    if (row.status === "promoting") {
      try {
        await manager.resumePromote(row.id);
      } catch {
        // staging already gone or save path unreachable — leave the row
      }
      continue;
    }
    if (row.status !== "downloading" && row.status !== "queued") continue;
    try {
      await manager.start(row.id);
    } catch {
      // stale queue rows or missing sidecars are skipped quietly
    }
  }
}
