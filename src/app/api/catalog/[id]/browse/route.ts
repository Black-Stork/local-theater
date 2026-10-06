import { NextResponse } from "next/server";
import { getCatalogItem, listFolderEntries } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const item = getCatalogItem(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (item.kind !== "folder") {
    return NextResponse.json(
      { error: "Not a folder" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const dir = url.searchParams.get("path") || "";
  const listing = listFolderEntries(item, dir);
  if (!listing) {
    return NextResponse.json(
      { error: "Could not read folder" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    id: item.id,
    name: item.name,
    categoryName: item.categoryName,
    currentRelative: listing.currentRelative,
    parentRelative: listing.parentRelative,
    entries: listing.entries,
  });
}
