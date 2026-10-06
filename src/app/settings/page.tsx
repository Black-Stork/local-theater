import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { getSettingsMap } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = getSettingsMap();

  return (
    <AppShell title="Settings" subtitle="Storage, speeds, scanner, theme">
      <SettingsForm
        initial={{
          downloadRoot: settings.downloadRoot,
          uploadLimit: settings.uploadLimit,
          downloadLimit: settings.downloadLimit ?? "-1",
          speedUnlimited: settings.speedUnlimited ?? "0",
          theme: settings.theme,
          scanCron: settings.scanCron || "* * * * *",
          lastScanAt: settings.lastScanAt || "",
        }}
      />
    </AppShell>
  );
}
