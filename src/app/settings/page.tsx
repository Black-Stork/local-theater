import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { getSettingsMap } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = getSettingsMap();

  return (
    <AppShell title="Settings" subtitle="Storage path, upload cap, scanner, theme">
      <SettingsForm
        initial={{
          downloadRoot: settings.downloadRoot,
          uploadLimit: settings.uploadLimit,
          theme: settings.theme,
          scanCron: settings.scanCron || "* * * * *",
          lastScanAt: settings.lastScanAt || "",
        }}
      />
    </AppShell>
  );
}
