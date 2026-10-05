import { AppShell } from "@/components/app-shell";
import { QueueClient } from "@/components/queue-client";
import { getTorrentManager } from "@/lib/torrent-manager";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const torrents = JSON.parse(
    JSON.stringify(getTorrentManager().list()),
  ) as ReturnType<ReturnType<typeof getTorrentManager>["list"]>;

  return (
    <AppShell
      title="Queue"
      subtitle="Live downloads on your local network"
    >
      <QueueClient initial={torrents} />
    </AppShell>
  );
}
