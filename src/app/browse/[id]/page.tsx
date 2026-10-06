import { Suspense } from "react";
import { BrowseClient } from "@/components/browse-client";
import { getCatalogItem } from "@/lib/library";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ path?: string }>;
};

export default async function BrowsePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { path = "" } = await searchParams;
  const item = getCatalogItem(id);

  if (!item || item.kind !== "folder") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-base font-medium">Folder not found</p>
        <a href="/" className="mt-3 inline-block text-sm text-accent">
          Back to catalog
        </a>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16 text-sm text-muted-foreground">
          Loading folder…
        </div>
      }
    >
      <BrowseClient
        id={item.id}
        title={item.name}
        categoryName={item.categoryName}
        initialPath={path}
      />
    </Suspense>
  );
}
