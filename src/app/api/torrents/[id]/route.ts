import { NextResponse } from "next/server";
import { getTorrentManager } from "@/lib/torrent-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const torrent = getTorrentManager().get(id);
  if (!torrent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(torrent);
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const deleteFiles = url.searchParams.get("deleteFiles") === "1";
  await getTorrentManager().remove(id, deleteFiles);
  return NextResponse.json({ ok: true });
}
