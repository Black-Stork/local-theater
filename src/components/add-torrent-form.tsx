"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db/schema";

export function AddTorrentForm({
  categories,
  onSuccess,
}: {
  categories: Category[];
  onSuccess?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [magnet, setMagnet] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(categoryId && (file || magnet.trim())),
    [categoryId, file, magnet],
  );

  function takeTorrentFile(next: File | null) {
    if (!next) return;
    const name = next.name.toLowerCase();
    // Prefer extension: iOS often leaves File.type empty or octet-stream.
    if (!name.endsWith(".torrent") && next.type !== "application/x-bittorrent") {
      setError("Choose a .torrent file");
      return;
    }
    setFile(next);
    setError(null);
  }

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("categoryId", categoryId);
      if (file) form.set("torrent", file);
      if (magnet.trim()) form.set("magnet", magnet.trim());

      const res = await fetch("/api/torrents", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to add torrent");
      setFile(null);
      setMagnet("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add torrent");
    } finally {
      setPending(false);
    }
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a category first, then come back to add a torrent.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-accent/35 bg-input/30 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>.torrent file</Label>
        {/*
          No accept= filter: iOS has no UTI for .torrent, so
          accept=".torrent,application/x-bittorrent" greys the file out
          in the Files picker. Validate the extension in takeTorrentFile.
        */}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={(e) => takeTorrentFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            takeTorrentFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition-colors",
            dragging
              ? "border-accent bg-accent/10"
              : "border-accent/40 bg-card/50 hover:border-accent/70",
          )}
        >
          <p className="text-sm font-medium">
            {file ? file.name : "Drop .torrent here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {file ? "Tap to replace" : "or tap to choose a file"}
          </p>
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="magnet">Or magnet link</Label>
        <Textarea
          id="magnet"
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
          placeholder="magnet:?xt=urn:btih:..."
          className="min-h-28 border-accent/35 font-mono text-xs"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button
        type="submit"
        disabled={!canSubmit || pending}
        className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {pending ? "Starting…" : "Start download"}
      </Button>
    </form>
  );
}
