"use client";

import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  formatBytes,
  formatEta,
  formatPercent,
  formatSpeed,
} from "@/lib/format";
import type { TorrentView } from "@/lib/types";

const statusLabel: Record<string, string> = {
  queued: "Queued",
  downloading: "Downloading",
  done: "Done",
  imported: "On disk",
  missing: "Missing",
  error: "Error",
};

export function TorrentCard({
  torrent,
  onRemove,
}: {
  torrent: TorrentView;
  onRemove: (id: string) => void;
}) {
  const pct = Math.round(torrent.progress * 1000) / 10;

  return (
    <Card className="border-accent/35 bg-card/80 shadow-none transition-transform active:scale-[0.99]">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium leading-snug">{torrent.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-accent/50 text-accent">
                {torrent.categoryName}
              </Badge>
              <Badge
                variant="secondary"
                className={
                  torrent.status === "error" || torrent.status === "missing"
                    ? "bg-destructive/20 text-destructive"
                    : torrent.status === "done" || torrent.status === "imported"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : ""
                }
              >
                {statusLabel[torrent.status] ?? torrent.status}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(torrent.id)}
            aria-label="Remove torrent"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>{formatPercent(torrent.progress)}</span>
            <span>
              {formatBytes(torrent.downloaded)} / {formatBytes(torrent.total)}
            </span>
          </div>
          <Progress value={pct} className="h-2 bg-muted" />
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground">
          <div>
            <p className="uppercase tracking-wide opacity-70">Down</p>
            <p className="text-foreground">{formatSpeed(torrent.downloadSpeed)}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide opacity-70">Up</p>
            <p className="text-foreground">{formatSpeed(torrent.uploadSpeed)}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide opacity-70">ETA · Peers</p>
            <p className="text-foreground">
              {formatEta(
                torrent.downloaded,
                torrent.total,
                torrent.downloadSpeed,
              )}{" "}
              · {torrent.peers}
            </p>
          </div>
        </div>

        {torrent.error ? (
          <p className="text-xs text-destructive">{torrent.error}</p>
        ) : (
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {torrent.savePath}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
