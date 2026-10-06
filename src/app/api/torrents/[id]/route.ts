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

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
  } | null;
  const action = body?.action;

  try {
    if (action === "stop" || action === "pause") {
      const torrent = await getTorrentManager().stop(id);
      return NextResponse.json(torrent);
    }
    if (action === "start" || action === "resume") {
      const torrent = await getTorrentManager().start(id);
      return NextResponse.json(torrent);
    }
    return NextResponse.json(
      { error: "action must be start or stop" },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update torrent";
    const status = message === "Not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  // Default: wipe downloaded content. Pass deleteFiles=0 to keep files.
  const deleteFiles = url.searchParams.get("deleteFiles") !== "0";
  await getTorrentManager().remove(id, deleteFiles);
  return NextResponse.json({ ok: true });
}
