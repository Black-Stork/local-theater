import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { v4 as uuid } from "uuid";
import type { Category, TorrentRow } from "./schema";

const DEFAULT_DOWNLOAD_ROOT = "/Volumes/9D41DB26/Downloads";

export const DEFAULT_SETTINGS = {
  downloadRoot: DEFAULT_DOWNLOAD_ROOT,
  uploadLimit: "-1",
  downloadLimit: "-1",
  speedUnlimited: "1",
  theme: "ember",
  scanCron: "* * * * *",
  lastScanAt: "",
} as const;

type GlobalDb = {
  __localTorrentSqlite?: DatabaseSync;
};

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "local-torrent.db");
}

function migrate(sqlite: DatabaseSync) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS torrents (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      info_hash TEXT,
      category_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      progress REAL NOT NULL DEFAULT 0,
      download_speed REAL NOT NULL DEFAULT 0,
      upload_speed REAL NOT NULL DEFAULT 0,
      downloaded REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      peers INTEGER NOT NULL DEFAULT 0,
      save_path TEXT NOT NULL,
      magnet TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  // Older builds defaulted to upload cap 0, which chokes reciprocation and slows downloads.
  sqlite
    .prepare(
      `UPDATE settings SET value = '-1'
       WHERE key = 'uploadLimit' AND value = '0'`,
    )
    .run();
}

function seed(sqlite: DatabaseSync) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    sqlite
      .prepare(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      )
      .run(key, value);
  }

  const count = sqlite
    .prepare("SELECT COUNT(*) AS count FROM categories")
    .get() as { count: number };
  if (count.count === 0) {
    const now = Date.now();
    const insert = sqlite.prepare(
      "INSERT INTO categories (id, name, slug, created_at) VALUES (?, ?, ?, ?)",
    );
    insert.run(uuid(), "Movies", "movies", now);
    insert.run(uuid(), "Shows", "shows", now);
  }

  const downloadRootRow = sqlite
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("downloadRoot") as { value: string } | undefined;
  const downloadRoot =
    downloadRootRow?.value ?? DEFAULT_SETTINGS.downloadRoot;

  try {
    fs.mkdirSync(downloadRoot, { recursive: true });
    const cats = sqlite
      .prepare("SELECT name FROM categories")
      .all() as Array<{ name: string }>;
    for (const cat of cats) {
      fs.mkdirSync(path.join(downloadRoot, cat.name), { recursive: true });
    }
  } catch (error) {
    console.warn(
      "[local-torrent] Could not create download folders:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function getDb() {
  const g = globalThis as GlobalDb;
  if (!g.__localTorrentSqlite) {
    const dbPath = ensureDataDir();
    const sqlite = new DatabaseSync(dbPath);
    g.__localTorrentSqlite = sqlite;
    migrate(sqlite);
    seed(sqlite);
  }
  return g.__localTorrentSqlite;
}

export function getSetting(key: string) {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return (
    row?.value ??
    DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] ??
    ""
  );
}

export function getSettingsMap() {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings")
    .all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);

  if (key === "downloadRoot") {
    ensureCategoryFolders(value);
  }
}

export function ensureCategoryFolders(downloadRoot: string) {
  try {
    fs.mkdirSync(downloadRoot, { recursive: true });
    for (const cat of listCategories()) {
      fs.mkdirSync(path.join(downloadRoot, cat.name), { recursive: true });
    }
  } catch (error) {
    console.warn(
      "[local-torrent] Could not create download folders:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    createdAt: new Date(Number(row.created_at)),
  };
}

export function listCategories(): Category[] {
  const rows = getDb()
    .prepare(
      "SELECT id, name, slug, created_at FROM categories ORDER BY name ASC",
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapCategory);
}

export function getCategoryById(id: string): Category | null {
  const row = getDb()
    .prepare(
      "SELECT id, name, slug, created_at FROM categories WHERE id = ?",
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapCategory(row) : null;
}

export function getCategoryBySlug(slug: string): Category | null {
  const row = getDb()
    .prepare(
      "SELECT id, name, slug, created_at FROM categories WHERE slug = ?",
    )
    .get(slug) as Record<string, unknown> | undefined;
  return row ? mapCategory(row) : null;
}

export function createCategory(name: string): Category {
  const trimmed = name.trim();
  const slug = slugify(trimmed);
  if (!trimmed || !slug) throw new Error("Invalid name");
  if (getCategoryBySlug(slug)) throw new Error("Category already exists");

  const id = uuid();
  const createdAt = Date.now();
  getDb()
    .prepare(
      "INSERT INTO categories (id, name, slug, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, trimmed, slug, createdAt);

  const downloadRoot = getSetting("downloadRoot");
  try {
    fs.mkdirSync(path.join(downloadRoot, trimmed), { recursive: true });
  } catch (error) {
    console.warn(
      "[local-torrent] Could not create category folder:",
      error instanceof Error ? error.message : error,
    );
  }

  return {
    id,
    name: trimmed,
    slug,
    createdAt: new Date(createdAt),
  };
}

function mapTorrent(row: Record<string, unknown>): TorrentRow {
  return {
    id: String(row.id),
    name: String(row.name),
    infoHash: row.info_hash == null ? null : String(row.info_hash),
    categoryId: String(row.category_id),
    status: String(row.status),
    progress: Number(row.progress),
    downloadSpeed: Number(row.download_speed),
    uploadSpeed: Number(row.upload_speed),
    downloaded: Number(row.downloaded),
    total: Number(row.total),
    peers: Number(row.peers),
    savePath: String(row.save_path),
    magnet: row.magnet == null ? null : String(row.magnet),
    error: row.error == null ? null : String(row.error),
    createdAt: new Date(Number(row.created_at)),
    updatedAt: new Date(Number(row.updated_at)),
  };
}

export function listTorrents(): TorrentRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM torrents ORDER BY created_at DESC")
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapTorrent);
}

export function getTorrentById(id: string): TorrentRow | null {
  const row = getDb()
    .prepare("SELECT * FROM torrents WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapTorrent(row) : null;
}

export function getTorrentByInfoHash(infoHash: string): TorrentRow | null {
  const row = getDb()
    .prepare("SELECT * FROM torrents WHERE info_hash = ?")
    .get(infoHash) as Record<string, unknown> | undefined;
  return row ? mapTorrent(row) : null;
}

function sqliteValue(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }
  return String(value);
}

export function insertTorrent(row: {
  id: string;
  name: string;
  infoHash: string | null;
  categoryId: string;
  status: string;
  savePath: string;
  magnet: string | null;
}) {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO torrents (
        id, name, info_hash, category_id, status, progress, download_speed,
        upload_speed, downloaded, total, peers, save_path, magnet, error,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?, NULL, ?, ?)`,
    )
    .run(
      sqliteValue(row.id),
      sqliteValue(row.name) ?? "Torrent",
      sqliteValue(row.infoHash),
      sqliteValue(row.categoryId),
      sqliteValue(row.status) ?? "queued",
      sqliteValue(row.savePath) ?? "",
      sqliteValue(row.magnet),
      now,
      now,
    );
}

export function updateTorrent(
  id: string,
  patch: Partial<{
    name: string;
    infoHash: string | null;
    status: string;
    progress: number;
    downloadSpeed: number;
    uploadSpeed: number;
    downloaded: number;
    total: number;
    peers: number;
    error: string | null;
  }>,
) {
  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  const map: Record<string, string> = {
    name: "name",
    infoHash: "info_hash",
    status: "status",
    progress: "progress",
    downloadSpeed: "download_speed",
    uploadSpeed: "upload_speed",
    downloaded: "downloaded",
    total: "total",
    peers: "peers",
    error: "error",
  };

  for (const [key, column] of Object.entries(map)) {
    if (key in patch) {
      const raw = patch[key as keyof typeof patch];
      if (raw === undefined) continue;
      fields.push(`${column} = ?`);
      values.push(sqliteValue(raw));
    }
  }

  if (fields.length === 0) return;
  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);

  getDb()
    .prepare(`UPDATE torrents SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function deleteTorrent(id: string) {
  getDb().prepare("DELETE FROM torrents WHERE id = ?").run(id);
}
