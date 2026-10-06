"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AddTorrentForm } from "@/components/add-torrent-form";
import { TorrentCard } from "@/components/torrent-card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Category } from "@/lib/db/schema";
import type { TorrentView } from "@/lib/types";

type ScanResult = {
  imported: unknown[];
  refreshed: unknown[];
  missing: unknown[];
  error?: string;
};

export function QueueClient({
  initial,
  categories,
  initialAddOpen = false,
}: {
  initial: TorrentView[];
  categories: Category[];
  initialAddOpen?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(initialAddOpen);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/torrents", { cache: "no-store" });
      if (!res.ok) return;
      setItems((await res.json()) as TorrentView[]);
    } catch {
      // Dev server restarts / brief network blips — poll again next tick.
    }
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = (await res.json()) as ScanResult;
      if (!res.ok) throw new Error(data.error || "Scan failed");
      await refresh();
      setScanNote(
        `Scan: +${data.imported?.length ?? 0} imported · ${data.refreshed?.length ?? 0} updated · ${data.missing?.length ?? 0} missing`,
      );
    } catch (error) {
      setScanNote(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [refresh]);

  useEffect(() => {
    const poll = setInterval(() => {
      void refresh();
    }, 1000);
    return () => clearInterval(poll);
  }, [refresh]);

  async function onRemove(id: string) {
    const confirmed = window.confirm(
      "Delete this torrent and its downloaded files from disk?",
    );
    if (!confirmed) return;
    setBusyId(id);
    try {
      await fetch(`/api/torrents/${id}?deleteFiles=1`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onStop(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/torrents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onStart(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/torrents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          Add
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-accent/40"
          disabled={scanning}
          onClick={() => void runScan()}
        >
          <RefreshCw className={`size-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning…" : "Scan"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {scanNote ?? "Server cron scans folders every minute"}
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-accent/35 bg-card/40 px-4 py-12 text-center">
          <p className="text-base font-medium">Queue is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap Add to start a download, or drop files into a category folder.
          </p>
          <Button
            type="button"
            className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-4" />
            Add torrent
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((torrent) => (
            <TorrentCard
              key={torrent.id}
              torrent={torrent}
              onRemove={onRemove}
              onStart={onStart}
              onStop={onStop}
              busy={busyId === torrent.id}
            />
          ))}
        </div>
      )}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[90dvh] flex-col gap-0 rounded-t-2xl border-accent/40 p-0"
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle>Add torrent</SheetTitle>
            <SheetDescription>
              Upload a .torrent or paste a magnet link
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <AddTorrentForm
              categories={categories}
              onSuccess={() => {
                setAddOpen(false);
                void refresh();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
