export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startScanCron } = await import("@/lib/scan-cron");
  startScanCron();
}
