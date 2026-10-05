"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category } from "@/lib/db/schema";

export function CategoriesClient({
  initial,
  downloadRoot,
}: {
  initial: Category[];
  downloadRoot: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState(initial);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as Category & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to add category");
      setItems((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onAdd} className="space-y-3 rounded-2xl border border-accent/35 bg-card/70 p-4">
        <div className="space-y-2">
          <Label htmlFor="category-name">Add category</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Documentaries"
            className="border-accent/35"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          type="submit"
          disabled={!name.trim() || pending}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {pending ? "Creating…" : "Add category"}
        </Button>
      </form>

      <div className="space-y-2">
        {items.map((cat) => (
          <Card key={cat.id} className="border-accent/30 bg-card/70 shadow-none">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">{cat.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {downloadRoot}/{cat.name}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
