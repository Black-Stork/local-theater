import { NextResponse } from "next/server";
import { getSettingsMap, setSetting } from "@/lib/db";
import { startScanCron } from "@/lib/scan-cron";
import { getTorrentManager } from "@/lib/torrent-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  startScanCron();
  return NextResponse.json(getSettingsMap());
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const allowed = [
    "downloadRoot",
    "uploadLimit",
    "downloadLimit",
    "speedUnlimited",
    "theme",
    "scanCron",
  ] as const;

  for (const key of allowed) {
    if (typeof body[key] === "string") {
      setSetting(key, body[key]);
    }
  }

  await getTorrentManager().applySpeedLimits();

  if (typeof body.scanCron === "string") {
    startScanCron(body.scanCron);
  } else {
    startScanCron();
  }

  return NextResponse.json(getSettingsMap());
}
