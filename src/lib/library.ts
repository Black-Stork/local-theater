import "server-only";
import fs from "node:fs";
import path from "node:path";
import { listCategories, listTorrents } from "@/lib/db";
import type { TorrentView } from "@/lib/types";

const VIDEO_EXT = new Set([
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".m4v",
  ".webm",
  ".wmv",
  ".m2ts",
  ".ts",
]);

export type CatalogItem = TorrentView & {
  entryPath: string;
  kind: "file" | "folder" | "missing";
  playable: boolean;
  videoCount: number;
  primaryVideoPath: string | null;
};

export type FolderEntry = {
  name: string;
  relativePath: string;
  kind: "dir" | "video" | "file";
  size: number;
};

export function isVideoFile(filePath: string) {
  return VIDEO_EXT.has(path.extname(filePath).toLowerCase());
}

export function resolveEntryPath(item: {
  name: string;
  savePath: string;
}): string | null {
  const direct = path.join(item.savePath, item.name);
  if (fs.existsSync(direct)) return direct;
  if (
    fs.existsSync(item.savePath) &&
    path.basename(item.savePath) === item.name
  ) {
    return item.savePath;
  }
  return null;
}

function isPathInside(parent: string, child: string) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function findVideos(root: string): string[] {
  const videos: string[] = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && isVideoFile(full)) {
        videos.push(full);
      }
    }
  }

  return videos.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function getVideosForItem(item: {
  name: string;
  savePath: string;
}): string[] {
  const entryPath = resolveEntryPath(item);
  if (!entryPath) return [];

  try {
    const stat = fs.statSync(entryPath);
    if (stat.isFile()) {
      return isVideoFile(entryPath) ? [entryPath] : [];
    }
    if (stat.isDirectory()) {
      return findVideos(entryPath);
    }
  } catch {
    return [];
  }
  return [];
}

export function resolveVideoPath(
  item: { name: string; savePath: string },
  fileParam?: string | null,
): string | null {
  const root = resolveEntryPath(item);
  if (!root) return null;

  const videos = getVideosForItem(item);
  if (videos.length === 0) return null;
  if (!fileParam) return videos[0];

  // Allow basename or relative path inside the item root
  const byRelative = path.resolve(root, fileParam);
  if (
    videos.some((v) => path.resolve(v) === byRelative) &&
    isPathInside(root, byRelative)
  ) {
    return byRelative;
  }

  const byBase = videos.find((v) => path.basename(v) === fileParam);
  return byBase ?? null;
}

export function listFolderEntries(
  item: { name: string; savePath: string },
  relativeDir = "",
): { root: string; currentRelative: string; parentRelative: string | null; entries: FolderEntry[] } | null {
  const root = resolveEntryPath(item);
  if (!root) return null;

  let rootStat: fs.Stats;
  try {
    rootStat = fs.statSync(root);
  } catch {
    return null;
  }
  if (!rootStat.isDirectory()) return null;

  const current = relativeDir
    ? path.resolve(root, relativeDir)
    : path.resolve(root);
  if (!isPathInside(root, current)) return null;

  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return null;
  }

  const entries: FolderEntry[] = [];
  for (const entry of dirents) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(current, entry.name);
    const relativePath = path.relative(root, full);
    try {
      if (entry.isDirectory()) {
        entries.push({
          name: entry.name,
          relativePath,
          kind: "dir",
          size: 0,
        });
      } else if (entry.isFile()) {
        const size = fs.statSync(full).size;
        entries.push({
          name: entry.name,
          relativePath,
          kind: isVideoFile(full) ? "video" : "file",
          size,
        });
      }
    } catch {
      // skip
    }
  }

  entries.sort((a, b) => {
    if (a.kind === "dir" && b.kind !== "dir") return -1;
    if (a.kind !== "dir" && b.kind === "dir") return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  const currentRelative = path.relative(root, current);
  const parentRelative =
    currentRelative === ""
      ? null
      : path.dirname(currentRelative) === "."
        ? ""
        : path.dirname(currentRelative);

  return {
    root,
    currentRelative,
    parentRelative,
    entries,
  };
}

export function listCatalog(options?: {
  categoryId?: string;
}): CatalogItem[] {
  const categories = new Map(listCategories().map((c) => [c.id, c.name]));
  const ready = listTorrents().filter((t) =>
    ["done", "imported"].includes(t.status),
  );

  return ready
    .filter((t) => !options?.categoryId || t.categoryId === options.categoryId)
    .map((t) => {
      const entryPath = resolveEntryPath(t) ?? path.join(t.savePath, t.name);
      let kind: CatalogItem["kind"] = "missing";
      try {
        const stat = fs.statSync(entryPath);
        kind = stat.isDirectory() ? "folder" : "file";
      } catch {
        kind = "missing";
      }
      const videos = getVideosForItem(t);
      return {
        ...t,
        categoryName: categories.get(t.categoryId) ?? "Unknown",
        swarmSeeds: null,
        swarmLeechers: null,
        connectedPeers: [],
        stagingPath: null,
        entryPath,
        kind,
        playable: videos.length > 0,
        videoCount: videos.length,
        primaryVideoPath: videos[0] ?? null,
      } satisfies CatalogItem;
    })
    .sort((a, b) => {
      if (a.playable !== b.playable) return a.playable ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
}

export function getCatalogItem(id: string): CatalogItem | null {
  return listCatalog().find((item) => item.id === id) ?? null;
}

export function mimeForVideo(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".mkv":
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    default:
      return "application/octet-stream";
  }
}
