"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { TorrentCard } from "@/components/torrent-card";
import { Button } from "@/components/ui/button";
import type { TorrentView } from "@/lib/types";

type ScanResult = {
  imported: unknown[];
  refreshed: unknown[];
  missing: unknown[];
  error?: string;
};

export function QueueClient({ initial }: { initial: TorrentView[] }) {
  const [items, setItems] = useState(initial);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/torrents", { cache: "no-store" });
    if (!res.ok) return;
    setItems((await res.json()) as TorrentView[]);
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
    const confirmed = window.confirm("Remove this item from the queue?");
    if (!confirmed) return;
    await fetch(`/api/torrents/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {scanNote ?? "Server cron scans folders every minute"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-accent/40"
          disabled={scanning}
          onClick={() => void runScan()}
        >
          <RefreshCw className={`size-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning…" : "Scan now"}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-accent/35 bg-card/40 px-4 py-12 text-center">
          <p className="text-base font-medium">Queue is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a torrent, or drop files into a category folder — cron will pick them up.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((torrent) => (
            <TorrentCard
              key={torrent.id}
              torrent={torrent}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
