import path from "node:path";
import fs from "node:fs";
import {
  getCatalogItem,
  mimeForVideo,
  resolveVideoPath,
} from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const item = getCatalogItem(id);
  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const fileParam = url.searchParams.get("file");
  const filePath = resolveVideoPath(item, fileParam);
  if (!filePath) {
    return new Response("No playable video found", { status: 404 });
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return new Response("Missing file", { status: 404 });
  }

  const mime = mimeForVideo(filePath);
  const range = request.headers.get("range");
  const nodeStreamToWeb = (stream: fs.ReadStream) =>
    new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => {
          controller.enqueue(
            chunk instanceof Uint8Array ? chunk : Buffer.from(chunk),
          );
        });
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      return new Response("Invalid range", { status: 416 });
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end >= stat.size ||
      start > end
    ) {
      return new Response("Invalid range", {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }

    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(nodeStreamToWeb(stream), {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "X-Content-Name": path.basename(filePath),
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(nodeStreamToWeb(stream), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "X-Content-Name": path.basename(filePath),
    },
  });
}
