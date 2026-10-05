import cron, { type ScheduledTask } from "node-cron";
import { getSetting, setSetting } from "@/lib/db";
import { scanDownloadFolders } from "@/lib/scanner";

const DEFAULT_CRON = "* * * * *"; // every minute

type GlobalCron = {
  __localTorrentScanCron?: ScheduledTask;
  __localTorrentScanCronExpr?: string;
};

function runScanJob() {
  try {
    const result = scanDownloadFolders();
    setSetting("lastScanAt", new Date().toISOString());
    const imported = result.imported.length;
    const refreshed = result.refreshed.length;
    const missing = result.missing.length;
    if (imported || refreshed || missing || result.errors.length) {
      console.log(
        `[scan-cron] +${imported} imported · ${refreshed} updated · ${missing} missing` +
          (result.errors.length ? ` · ${result.errors.length} errors` : ""),
      );
    }
  } catch (error) {
    console.error(
      "[scan-cron] failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function startScanCron(expression?: string) {
  if (typeof window !== "undefined") return;

  const g = globalThis as GlobalCron;
  let expr = expression || getSetting("scanCron") || DEFAULT_CRON;

  if (!cron.validate(expr)) {
    console.warn(
      `[scan-cron] invalid expression "${expr}", falling back to ${DEFAULT_CRON}`,
    );
    expr = DEFAULT_CRON;
  }

  if (g.__localTorrentScanCron && g.__localTorrentScanCronExpr === expr) {
    return g.__localTorrentScanCron;
  }

  if (g.__localTorrentScanCron) {
    try {
      g.__localTorrentScanCron.stop();
      g.__localTorrentScanCron.destroy();
    } catch {
      // ignore stop/destroy races during HMR
    }
  }

  const task = cron.schedule(expr, () => {
    runScanJob();
  });

  g.__localTorrentScanCron = task;
  g.__localTorrentScanCronExpr = expr;
  setSetting("scanCron", expr);
  console.log(`[scan-cron] scheduled: ${expr}`);
  return task;
}

export function getScanCronExpression() {
  return getSetting("scanCron") || DEFAULT_CRON;
}
