import { NextResponse } from "next/server";
import { getSettingsMap, setSetting } from "@/lib/db";
import { scanDownloadFolders } from "@/lib/scanner";
import { startScanCron } from "@/lib/scan-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    startScanCron();
    const result = scanDownloadFolders();
    setSetting("lastScanAt", new Date().toISOString());
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
