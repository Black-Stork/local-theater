import { NextResponse } from "next/server";
import { getTorrentManager } from "@/lib/torrent-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getTorrentManager().list());
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const manager = getTorrentManager();

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const categoryId = String(form.get("categoryId") || "");
      const file = form.get("torrent");
      const magnet = String(form.get("magnet") || "").trim();

      if (!categoryId) {
        return NextResponse.json(
          { error: "Category is required" },
          { status: 400 },
        );
      }

      if (file instanceof File && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const torrent = await manager.addFromFile({ buffer, categoryId });
        return NextResponse.json(torrent, { status: 201 });
      }

      if (magnet) {
        const torrent = await manager.addFromMagnet({ magnet, categoryId });
        return NextResponse.json(torrent, { status: 201 });
      }

      return NextResponse.json(
        { error: "Provide a .torrent file or magnet link" },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      categoryId?: string;
      magnet?: string;
    };
    if (!body.categoryId || !body.magnet) {
      return NextResponse.json(
        { error: "categoryId and magnet are required" },
        { status: 400 },
      );
    }
    const torrent = await manager.addFromMagnet({
      categoryId: body.categoryId,
      magnet: body.magnet,
    });
    return NextResponse.json(torrent, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add torrent";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
