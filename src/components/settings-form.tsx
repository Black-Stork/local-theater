"use client";

import { useState } from "react";
import { FolderPicker } from "@/components/folder-picker";
import { useTheme, type AccentTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({
  initial,
}: {
  initial: {
    downloadRoot: string;
    uploadLimit: string;
    theme: string;
    scanCron: string;
    lastScanAt: string;
  };
}) {
  const { theme, setTheme } = useTheme();
  const [downloadRoot, setDownloadRoot] = useState(initial.downloadRoot);
  const [uploadLimit, setUploadLimit] = useState(initial.uploadLimit);
  const [scanCron, setScanCron] = useState(initial.scanCron || "* * * * *");
  const [lastScanAt, setLastScanAt] = useState(initial.lastScanAt);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadRoot, uploadLimit, theme, scanCron }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const data = (await res.json()) as { lastScanAt?: string; scanCron?: string };
      if (data.scanCron) setScanCron(data.scanCron);
      if (data.lastScanAt) setLastScanAt(data.lastScanAt);
      setMessage("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  async function onScan() {
    setScanning(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = (await res.json()) as {
        imported?: unknown[];
        refreshed?: unknown[];
        missing?: unknown[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setLastScanAt(new Date().toISOString());
      setMessage(
        `Scan done: +${data.imported?.length ?? 0} imported · ${data.refreshed?.length ?? 0} updated · ${data.missing?.length ?? 0} missing`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-5">
      <div className="space-y-2">
        <Label>Download folder</Label>
        <FolderPicker value={downloadRoot} onChange={setDownloadRoot} />
        <p className="text-xs text-muted-foreground">
          Browse folders on this Mac. Categories become subfolders under the path you pick.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="uploadLimit">Upload limit (bytes/sec)</Label>
        <Input
          id="uploadLimit"
          type="number"
          min={0}
          value={uploadLimit}
          onChange={(e) => setUploadLimit(e.target.value)}
          className="border-accent/35 font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Use <span className="font-mono text-accent">0</span> for no upload.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scanCron">Folder scan cron</Label>
        <Input
          id="scanCron"
          value={scanCron}
          onChange={(e) => setScanCron(e.target.value)}
          className="border-accent/35 font-mono text-xs"
          placeholder="* * * * *"
        />
        <p className="text-xs text-muted-foreground">
          Standard 5-field cron. Default <span className="font-mono text-accent">* * * * *</span> = every minute.
          {lastScanAt ? (
            <>
              {" "}
              Last scan:{" "}
              <span className="font-mono text-foreground">
                {new Date(lastScanAt).toLocaleString()}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="theme">Accent theme</Label>
        <select
          id="theme"
          value={theme}
          onChange={(e) => setTheme((e.target.value as AccentTheme) || "ember")}
          className="flex h-10 w-full rounded-lg border border-accent/35 bg-input/30 px-3 text-sm outline-none"
        >
          <option value="ember">Ember (orange)</option>
          <option value="signal">Signal (mint)</option>
        </select>
      </div>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {pending ? "Saving…" : "Save settings"}
      </Button>

      <Button
        type="button"
        variant="outline"
        disabled={scanning}
        className="h-11 w-full border-accent/40"
        onClick={() => void onScan()}
      >
        {scanning ? "Scanning folders…" : "Scan download folders now"}
      </Button>
    </form>
  );
}
