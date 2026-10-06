import { NextResponse } from "next/server";
import {
  getCatalogItem,
  getVideosForItem,
} from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const item = getCatalogItem(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const videos = getVideosForItem(item).map((filePath) => ({
    path: filePath,
    name: filePath.split(/[\\/]/).pop() || filePath,
  }));

  return NextResponse.json({
    id: item.id,
    name: item.name,
    categoryName: item.categoryName,
    playable: item.playable,
    videos,
  });
}
