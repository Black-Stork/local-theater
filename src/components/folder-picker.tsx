"use client";

import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type BrowseResponse = {
  current: string;
  parent: string | null;
  entries: Array<{ name: string; path: string }>;
  shortcuts: Array<{ name: string; path: string }>;
  error?: string;
};

export function FolderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(value || "/Volumes");
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<BrowseResponse["entries"]>([]);
  const [shortcuts, setShortcuts] = useState<BrowseResponse["shortcuts"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (dir: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/fs/browse?path=${encodeURIComponent(dir)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as BrowseResponse;
      if (!res.ok) throw new Error(data.error || "Could not open folder");
      setCurrent(data.current);
      setParent(data.parent);
      setEntries(data.entries);
      setShortcuts(data.shortcuts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open folder");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(value || "/Volumes");
  }, [open, value, load]);

  return (
    <>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1 rounded-lg border border-accent/35 bg-input/30 px-3 py-2 font-mono text-xs break-all">
          {value || "No folder selected"}
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-accent/40"
          onClick={() => setOpen(true)}
        >
          <FolderOpen className="size-4" />
          Browse
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85dvh] flex-col gap-0 rounded-t-2xl border-accent/40 p-0"
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle>Choose download folder</SheetTitle>
            <SheetDescription className="font-mono text-[11px] break-all">
              {current}
            </SheetDescription>
          </SheetHeader>

          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {shortcuts.map((item) => (
              <Button
                key={item.path}
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-accent/30"
                onClick={() => void load(item.path)}
              >
                {item.name}
              </Button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {parent ? (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-muted"
                onClick={() => void load(parent)}
              >
                <Folder className="size-4 text-muted-foreground" />
                <span className="font-medium">..</span>
                <span className="text-xs text-muted-foreground">Up</span>
              </button>
            ) : null}

            {loading ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">Loading…</p>
            ) : error ? (
              <p className="px-3 py-6 text-sm text-destructive">{error}</p>
            ) : entries.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">
                No subfolders here
              </p>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-muted"
                  onClick={() => void load(entry.path)}
                >
                  <Folder className="size-4 text-accent" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.name}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>

          <SheetFooter className="border-t border-border px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="border-accent/35"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => {
                onChange(current);
                setOpen(false);
              }}
            >
              Use this folder
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
