"use client";

import {
  ArrowLeft,
  ChevronRight,
  File,
  Folder,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type FolderEntry = {
  name: string;
  relativePath: string;
  kind: "dir" | "video" | "file";
  size: number;
};

type BrowsePayload = {
  id: string;
  name: string;
  categoryName: string;
  currentRelative: string;
  parentRelative: string | null;
  entries: FolderEntry[];
  error?: string;
};

export function BrowseClient({
  id,
  title,
  categoryName,
  initialPath = "",
}: {
  id: string;
  title: string;
  categoryName: string;
  initialPath?: string;
}) {
  const router = useRouter();
  const [path, setPath] = useState(initialPath);
  const [data, setData] = useState<BrowsePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextPath: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/catalog/${id}/browse?path=${encodeURIComponent(nextPath)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as BrowsePayload;
        if (!res.ok) throw new Error(json.error || "Could not open folder");
        setData(json);
        const current = json.currentRelative || "";
        setPath(current);
        const url =
          current === ""
            ? `/browse/${id}`
            : `/browse/${id}?path=${encodeURIComponent(current)}`;
        router.replace(url, { scroll: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open folder");
      } finally {
        setLoading(false);
      }
    },
    [id, router],
  );

  useEffect(() => {
    void load(initialPath);
  }, [load, initialPath]);

  const crumbs = path ? path.split(/[\\/]/).filter(Boolean) : [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-10 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "border-accent/40",
          )}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            {categoryName}
          </p>
          <h1 className="truncate text-lg font-semibold">{title}</h1>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
          onClick={() => void load("")}
        >
          Root
        </button>
        {crumbs.map((crumb, index) => {
          const rel = crumbs.slice(0, index + 1).join("/");
          return (
            <span key={rel} className="flex items-center gap-1">
              <ChevronRight className="size-3" />
              <button
                type="button"
                className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                onClick={() => void load(rel)}
              >
                {crumb}
              </button>
            </span>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="space-y-2">
          {data?.parentRelative !== null && data ? (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm hover:border-accent/40"
              onClick={() => void load(data.parentRelative ?? "")}
            >
              <Folder className="size-4 text-muted-foreground" />
              <span>..</span>
            </button>
          ) : null}

          {(data?.entries.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
              Empty folder
            </p>
          ) : (
            data?.entries.map((entry) => {
              if (entry.kind === "dir") {
                return (
                  <button
                    key={entry.relativePath}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-card/70 px-3 py-3 text-left hover:border-accent/60"
                    onClick={() => void load(entry.relativePath)}
                  >
                    <Folder className="size-4 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {entry.name}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                );
              }

              if (entry.kind === "video") {
                return (
                  <Link
                    key={entry.relativePath}
                    href={`/watch/${id}?file=${encodeURIComponent(entry.relativePath)}`}
                    className="flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-card/70 px-3 py-3 text-left hover:border-accent/60"
                  >
                    <Play className="size-4 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {entry.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatBytes(entry.size)}
                      </span>
                    </span>
                  </Link>
                );
              }

              return (
                <div
                  key={entry.relativePath}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/70 px-3 py-3 text-sm text-muted-foreground"
                >
                  <File className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
