import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DirEntry = {
  name: string;
  path: string;
};

function safeResolve(input: string) {
  const resolved = path.resolve(input || "/");
  return resolved;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("path") || "/Volumes";
  const current = safeResolve(requested);

  try {
    const stat = fs.statSync(current);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 },
      );
    }

    const parent = path.dirname(current);
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({
        name: entry.name,
        path: path.join(current, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) as DirEntry[];

    const shortcuts: DirEntry[] = [
      { name: "Volumes", path: "/Volumes" },
      { name: "Home", path: os.homedir() },
      { name: "Root", path: "/" },
    ];

    return NextResponse.json({
      current,
      parent: parent === current ? null : parent,
      entries,
      shortcuts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not read directory",
        current,
      },
      { status: 400 },
    );
  }
}
