import "server-only";
import { getSettingsMap } from "@/lib/db";

/** WebTorrent uses -1 for unlimited. Server-only. */
export function resolveSpeedLimits(settings = getSettingsMap()) {
  if (settings.speedUnlimited === "1") {
    return { uploadLimit: -1, downloadLimit: -1, unlimited: true as const };
  }

  const uploadRaw = Number(settings.uploadLimit ?? "0");
  const downloadRaw = Number(settings.downloadLimit ?? "-1");

  return {
    uploadLimit: Number.isFinite(uploadRaw) ? uploadRaw : 0,
    downloadLimit: Number.isFinite(downloadRaw) ? downloadRaw : -1,
    unlimited: false as const,
  };
}
