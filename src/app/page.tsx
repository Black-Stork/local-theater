import { AppShell } from "@/components/app-shell";
import { CatalogClient } from "@/components/catalog-client";
import { listCategories } from "@/lib/db";
import { listCatalog } from "@/lib/library";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const categories = listCategories().map((c) => ({ id: c.id, name: c.name }));
  const items = listCatalog().map((item) => ({
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    total: item.total,
    playable: item.playable,
    videoCount: item.videoCount,
    kind: item.kind,
  }));

  return (
    <AppShell title="Catalog" subtitle="Pick something to watch">
      <CatalogClient initial={items} categories={categories} />
    </AppShell>
  );
}
