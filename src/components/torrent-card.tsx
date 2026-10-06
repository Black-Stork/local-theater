"use client";

import { Pause, Play, Trash2 } from "lucide-react";
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
  paused: "Paused",
  done: "Done",
  imported: "On disk",
  missing: "Missing",
  error: "Error",
};

const CONTROLLABLE = new Set(["queued", "downloading", "paused", "error"]);

export function TorrentCard({
  torrent,
  onRemove,
  onStart,
  onStop,
  busy = false,
}: {
  torrent: TorrentView;
  onRemove: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  busy?: boolean;
}) {
  const pct = Math.round(torrent.progress * 1000) / 10;
  const canControl = CONTROLLABLE.has(torrent.status);
  const isRunning = torrent.status === "downloading" || torrent.status === "queued";
  const connCount = torrent.connectedPeers.length || torrent.peers;

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
                      : torrent.status === "paused"
                        ? "bg-amber-500/15 text-amber-400"
                        : ""
                }
              >
                {statusLabel[torrent.status] ?? torrent.status}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {canControl ? (
              isRunning ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  disabled={busy}
                  onClick={() => onStop(torrent.id)}
                  aria-label="Stop download"
                >
                  <Pause className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-accent"
                  disabled={busy}
                  onClick={() => onStart(torrent.id)}
                  aria-label="Start download"
                >
                  <Play className="size-4" />
                </Button>
              )
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={() => onRemove(torrent.id)}
              aria-label="Remove torrent"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
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
            <p className="uppercase tracking-wide opacity-70">ETA · Conn</p>
            <p className="text-foreground">
              {formatEta(
                torrent.downloaded,
                torrent.total,
                torrent.downloadSpeed,
              )}{" "}
              · {connCount}
            </p>
            {torrent.swarmSeeds != null && torrent.swarmLeechers != null ? (
              <p className="mt-0.5 text-[10px] opacity-80">
                Swarm {torrent.swarmSeeds}↑ {torrent.swarmLeechers}↓
              </p>
            ) : null}
          </div>
        </div>

        {connCount > 0 ? (
          <div className="space-y-1.5 rounded-xl border border-border/80 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Connected peers ({connCount})
            </p>
            <ul className="max-h-36 space-y-1 overflow-y-auto font-mono text-[10px]">
              {(torrent.connectedPeers.length > 0
                ? torrent.connectedPeers
                : Array.from({ length: connCount }, (_, i) => ({
                    address: `Connection ${i + 1}`,
                    kind: "peer",
                    source: "Active",
                    downloadSpeed: 0,
                    uploadSpeed: 0,
                  }))
              ).map((peer, index) => (
                <li
                  key={`${peer.address}-${peer.source}-${peer.kind}-${index}`}
                  className="flex items-start justify-between gap-2 border-b border-border/40 pb-1 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{peer.address}</p>
                    <p className="text-muted-foreground">
                      {peer.source} · {peer.kind}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-muted-foreground">
                    ↓ {formatSpeed(peer.downloadSpeed)}
                    <br />↑ {formatSpeed(peer.uploadSpeed)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : isRunning ? (
          <p className="text-[10px] text-muted-foreground">
            {torrent.downloadSpeed > 0
              ? "Discovering more peers via trackers and DHT…"
              : "No peers connected — searching trackers/DHT (may take a few minutes)…"}
          </p>
        ) : null}

        {torrent.error ? (
          <p className="text-xs text-destructive">{torrent.error}</p>
        ) : torrent.stagingPath &&
          (torrent.status === "downloading" ||
            torrent.status === "queued" ||
            torrent.status === "paused") ? (
          <div className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
            <p className="truncate">
              <span className="text-accent">Local</span> {torrent.stagingPath}
            </p>
            <p className="truncate">
              <span className="opacity-70">Then →</span> {torrent.savePath}
            </p>
          </div>
        ) : (
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {torrent.savePath}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
