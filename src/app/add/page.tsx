import { AddTorrentForm } from "@/components/add-torrent-form";
import { AppShell } from "@/components/app-shell";
import { listCategories } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function AddPage() {
  const cats = JSON.parse(JSON.stringify(listCategories())) as ReturnType<
    typeof listCategories
  >;

  return (
    <AppShell
      title="Add torrent"
      subtitle="Upload a .torrent or paste a magnet"
    >
      <AddTorrentForm categories={cats} />
    </AppShell>
  );
}
