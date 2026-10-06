import path from "node:path";
import { WatchClient } from "@/components/watch-client";
import { getCatalogItem, resolveVideoPath } from "@/lib/library";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string }>;
};

export default async function WatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { file } = await searchParams;
  const item = getCatalogItem(id);

  if (!item) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-base font-medium">Title not found</p>
        <a href="/" className="mt-3 inline-block text-sm text-accent">
          Back to catalog
        </a>
      </div>
    );
  }

  const videoPath = resolveVideoPath(item, file);
  if (!videoPath) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-base font-medium">No playable video found</p>
        <a
          href={item.kind === "folder" ? `/browse/${item.id}` : "/"}
          className="mt-3 inline-block text-sm text-accent"
        >
          Go back
        </a>
      </div>
    );
  }

  const displayName = path.basename(videoPath);
  const fileParam =
    file ||
    (item.kind === "file"
      ? path.basename(item.entryPath)
      : path.relative(item.entryPath, videoPath));

  let backHref = "/";
  if (item.kind === "folder") {
    const parent = path.posix.dirname(
      String(fileParam).replaceAll("\\", "/"),
    );
    backHref =
      !parent || parent === "."
        ? `/browse/${item.id}`
        : `/browse/${item.id}?path=${encodeURIComponent(parent)}`;
  }

  return (
    <WatchClient
      id={item.id}
      title={displayName}
      categoryName={item.categoryName}
      file={String(fileParam)}
      backHref={backHref}
    />
  );
}
