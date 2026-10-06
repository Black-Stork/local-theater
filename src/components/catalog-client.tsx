"use client";

import { ChevronRight, Clapperboard, Folder, Play } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CatalogCardItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  total: number;
  playable: boolean;
  videoCount: number;
  kind: "file" | "folder" | "missing";
};

export function CatalogClient({
  initial,
  categories,
}: {
  initial: CatalogCardItem[];
  categories: Array<{ id: string; name: string }>;
}) {
  const [categoryId, setCategoryId] = useState<string>("all");

  const items = useMemo(() => {
    if (categoryId === "all") return initial;
    return initial.filter((item) => item.categoryId === categoryId);
  }, [initial, categoryId]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          type="button"
          size="sm"
          variant={categoryId === "all" ? "default" : "outline"}
          className={
            categoryId === "all"
              ? "bg-accent text-accent-foreground hover:bg-accent/90"
              : "border-accent/35"
          }
          onClick={() => setCategoryId("all")}
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            type="button"
            size="sm"
            variant={categoryId === cat.id ? "default" : "outline"}
            className={
              categoryId === cat.id
                ? "shrink-0 bg-accent text-accent-foreground hover:bg-accent/90"
                : "shrink-0 border-accent/35"
            }
            onClick={() => setCategoryId(cat.id)}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-accent/35 bg-card/40 px-4 py-12 text-center">
          <Clapperboard className="mx-auto size-8 text-accent" />
          <p className="mt-3 text-base font-medium">Nothing to watch yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Finished downloads show up here. Add a torrent or wait for the scanner.
          </p>
          <Link
            href="/queue?add=1"
            className={cn(
              buttonVariants({ size: "default" }),
              "mt-4 bg-accent text-accent-foreground hover:bg-accent/90",
            )}
          >
            Add something
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isFolder = item.kind === "folder";
            const href = isFolder
              ? `/browse/${item.id}`
              : item.playable
                ? `/watch/${item.id}`
                : null;

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-accent/30 bg-card/80 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg border border-accent/30 bg-accent/10 p-2 text-accent">
                    {isFolder ? (
                      <Folder className="size-5" />
                    ) : (
                      <Clapperboard className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-medium leading-snug">
                      {item.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-accent/50 text-accent"
                      >
                        {item.categoryName}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {isFolder
                          ? `${item.videoCount} video${item.videoCount === 1 ? "" : "s"} · folder`
                          : formatBytes(item.total)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {href ? (
                    <Link
                      href={href}
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "h-10 w-full bg-accent text-accent-foreground hover:bg-accent/90",
                      )}
                    >
                      {isFolder ? (
                        <>
                          Open folder
                          <ChevronRight className="size-4" />
                        </>
                      ) : (
                        <>
                          <Play className="size-4" />
                          Watch
                        </>
                      )}
                    </Link>
                  ) : (
                    <p className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
                      On disk, but no playable video file found yet.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
