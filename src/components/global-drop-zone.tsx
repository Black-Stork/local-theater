"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Category } from "@/lib/db/schema";

export function GlobalDropZone() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let depth = 0;

    function hasFiles(e: DragEvent) {
      return Array.from(e.dataTransfer?.types ?? []).includes("Files");
    }

    function onDragEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setActive(true);
    }

    function onDragOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    }

    function onDragLeave(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    }

    function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const next = e.dataTransfer?.files?.[0] ?? null;
      if (!next) return;
      const name = next.name.toLowerCase();
      if (!name.endsWith(".torrent") && next.type !== "application/x-bittorrent") {
        setError("Only .torrent files can be dropped");
        setFile(null);
        return;
      }
      setError(null);
      setFile(next);
      void loadCategories();
    }

    async function loadCategories() {
      const res = await fetch("/api/categories", { cache: "no-store" });
      if (!res.ok) return;
      const rows = (await res.json()) as Category[];
      setCategories(rows);
      setCategoryId((prev) => prev || rows[0]?.id || "");
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  async function startDownload() {
    if (!file || !categoryId) return;
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("categoryId", categoryId);
      form.set("torrent", file);
      const res = await fetch("/api/torrents", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to add torrent");
      setFile(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add torrent");
    } finally {
      setPending(false);
    }
  }

  if (!active && !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-accent/50 bg-card p-5 shadow-2xl">
        {active && !file ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-accent bg-accent/10 px-4 text-center">
            <p className="text-base font-medium text-accent">
              Drop .torrent to download
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                New download
              </p>
              <p className="mt-1 truncate text-sm font-medium">{file?.name}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="drop-category">Category</Label>
              <select
                id="drop-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-accent/35 bg-input/30 px-3 text-sm outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-accent/35"
                onClick={() => {
                  setFile(null);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!categoryId || pending}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => void startDownload()}
              >
                {pending ? "Starting…" : "Start"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
