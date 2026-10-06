import "server-only";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import {
  getSetting,
  insertTorrent,
  listCategories,
  listTorrents,
  updateTorrent,
} from "@/lib/db";

const SKIP_NAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  ".localized",
]);

export type ScanResult = {
  scannedCategories: number;
  imported: Array<{ name: string; category: string; bytes: number }>;
  refreshed: Array<{ name: string; category: string; bytes: number }>;
  missing: Array<{ name: string; category: string }>;
  skipped: number;
  errors: string[];
};

function shouldSkipName(name: string) {
  const lower = name.toLowerCase();
  if (name.startsWith(".")) return true;
  if (SKIP_NAMES.has(lower)) return true;
  if (lower.endsWith(".torrent")) return true;
  if (lower.endsWith(".parts")) return true;
  if (lower.endsWith(".!qb")) return true;
  if (lower.endsWith(".part")) return true;
  if (lower.endsWith(".tmp")) return true;
  return false;
}

function entrySize(entryPath: string, stat: fs.Stats): number {
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;

  let total = 0;
  const stack = [entryPath];
  while (stack.length) {
    const current = stack.pop()!;
    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (child.name.startsWith(".")) continue;
      const childPath = path.join(current, child.name);
      try {
        if (child.isDirectory()) {
          stack.push(childPath);
        } else if (child.isFile()) {
          total += fs.statSync(childPath).size;
        }
      } catch {
        // skip unreadable entries
      }
    }
  }
  return total;
}

function normalizePath(p: string) {
  return path.resolve(p);
}

function pathsMatch(a: string, b: string) {
  return normalizePath(a) === normalizePath(b);
}

export function scanDownloadFolders(): ScanResult {
  const downloadRoot = getSetting("downloadRoot");
  const categories = listCategories();
  const torrents = listTorrents();
  const result: ScanResult = {
    scannedCategories: 0,
    imported: [],
    refreshed: [],
    missing: [],
    skipped: 0,
    errors: [],
  };

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  for (const category of categories) {
    const categoryDir = path.join(downloadRoot, category.name);
    result.scannedCategories += 1;

    let entries: fs.Dirent[];
    try {
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
        continue;
      }
      entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    } catch (error) {
      result.errors.push(
        `${category.name}: ${error instanceof Error ? error.message : "unreadable"}`,
      );
      continue;
    }

    const seenNames = new Set<string>();

    for (const entry of entries) {
      if (shouldSkipName(entry.name)) {
        result.skipped += 1;
        continue;
      }
      if (!entry.isFile() && !entry.isDirectory()) {
        result.skipped += 1;
        continue;
      }

      seenNames.add(entry.name);
      const entryPath = path.join(categoryDir, entry.name);

      let size = 0;
      try {
        const stat = fs.statSync(entryPath);
        size = entrySize(entryPath, stat);
      } catch (error) {
        result.errors.push(
          `${entry.name}: ${error instanceof Error ? error.message : "stat failed"}`,
        );
        continue;
      }

      const existing = torrents.find((t) => {
        if (t.categoryId !== category.id) return false;
        if (t.name === entry.name) return true;
        if (pathsMatch(t.savePath, entryPath)) return true;
        if (pathsMatch(path.join(t.savePath, t.name), entryPath)) return true;
        return false;
      });

      if (existing) {
        if (
          existing.status === "downloading" ||
          existing.status === "queued"
        ) {
          result.skipped += 1;
          continue;
        }

        const changed =
          existing.total !== size ||
          existing.downloaded !== size ||
          existing.progress !== 1 ||
          existing.status === "missing";

        if (changed) {
          updateTorrent(existing.id, {
            status: "imported",
            progress: 1,
            downloaded: size,
            total: size,
            downloadSpeed: 0,
            uploadSpeed: 0,
            peers: 0,
            error: null,
          });
          result.refreshed.push({
            name: entry.name,
            category: category.name,
            bytes: size,
          });
        } else {
          result.skipped += 1;
        }
        continue;
      }

      const id = uuid();
      insertTorrent({
        id,
        name: entry.name,
        infoHash: null,
        categoryId: category.id,
        status: "imported",
        savePath: categoryDir,
        magnet: null,
      });
      updateTorrent(id, {
        status: "imported",
        progress: 1,
        downloaded: size,
        total: size,
        downloadSpeed: 0,
        uploadSpeed: 0,
        peers: 0,
        error: null,
      });
      result.imported.push({
        name: entry.name,
        category: category.name,
        bytes: size,
      });
    }

    for (const torrent of torrents) {
      if (torrent.categoryId !== category.id) continue;
      if (
        torrent.status === "downloading" ||
        torrent.status === "queued" ||
        torrent.status === "error"
      ) {
        continue;
      }

      const expectedTopLevel = path.join(categoryDir, torrent.name);
      let topLevelExists = false;
      try {
        topLevelExists = fs.existsSync(expectedTopLevel);
      } catch {
        topLevelExists = false;
      }

      if (!topLevelExists && torrent.status !== "missing") {
        updateTorrent(torrent.id, {
          status: "missing",
          downloadSpeed: 0,
          uploadSpeed: 0,
          peers: 0,
          error: "Not found on disk",
        });
        result.missing.push({
          name: torrent.name,
          category: categoryById.get(torrent.categoryId)?.name ?? category.name,
        });
      }
    }
  }

  return result;
}
