import { AppShell } from "@/components/app-shell";
import { QueueClient } from "@/components/queue-client";
import { listCategories } from "@/lib/db";
import { getTorrentManager } from "@/lib/torrent-manager";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ add?: string }>;
};

export default async function QueuePage({ searchParams }: Props) {
  const params = await searchParams;
  const torrents = JSON.parse(
    JSON.stringify(getTorrentManager().list()),
  ) as ReturnType<ReturnType<typeof getTorrentManager>["list"]>;
  const categories = JSON.parse(
    JSON.stringify(listCategories()),
  ) as ReturnType<typeof listCategories>;

  return (
    <AppShell title="Queue" subtitle="Downloads and new torrents">
      <QueueClient
        initial={torrents}
        categories={categories}
        initialAddOpen={params.add === "1"}
      />
    </AppShell>
  );
}
