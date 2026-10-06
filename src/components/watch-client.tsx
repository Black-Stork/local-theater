"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WatchClient({
  id,
  title,
  categoryName,
  file,
  backHref,
}: {
  id: string;
  title: string;
  categoryName: string;
  file: string;
  backHref: string;
}) {
  const src = useMemo(() => {
    if (!file) return `/api/media/${id}`;
    return `/api/media/${id}?file=${encodeURIComponent(file)}`;
  }, [id, file]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-10 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={backHref}
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

      {!file && !src ? (
        <p className="text-sm text-muted-foreground">No playable video found.</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-accent/35 bg-black">
            <video
              key={src}
              className="aspect-video w-full bg-black"
              controls
              playsInline
              preload="metadata"
              src={src}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Phone tip: some browsers struggle with MKV. MP4 usually plays best.
          </p>
        </div>
      )}
    </div>
  );
}
