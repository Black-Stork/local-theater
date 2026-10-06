import { NextResponse } from "next/server";
import { listCatalog } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const items = listCatalog({ categoryId }).map((item) => ({
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    status: item.status,
    total: item.total,
    playable: item.playable,
    videoCount: item.videoCount,
    kind: item.kind,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
  return NextResponse.json(items);
}
