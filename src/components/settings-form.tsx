"use client";

import { useState } from "react";
import { FolderPicker } from "@/components/folder-picker";
import { useTheme, type AccentTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bytesToKbInput, kbToBytes } from "@/lib/speed-format";

export function SettingsForm({
  initial,
}: {
  initial: {
    downloadRoot: string;
    uploadLimit: string;
    downloadLimit: string;
    speedUnlimited: string;
    theme: string;
    scanCron: string;
    lastScanAt: string;
  };
}) {
  const { theme, setTheme } = useTheme();
  const [downloadRoot, setDownloadRoot] = useState(initial.downloadRoot);
  const [unlimited, setUnlimited] = useState(initial.speedUnlimited === "1");
  const [uploadKb, setUploadKb] = useState(bytesToKbInput(initial.uploadLimit));
  const [downloadKb, setDownloadKb] = useState(
    bytesToKbInput(initial.downloadLimit),
  );
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
      const uploadLimit = unlimited
        ? "-1"
        : kbToBytes(uploadKb === "" ? "0" : uploadKb);
      const downloadLimit = unlimited
        ? "-1"
        : downloadKb === ""
          ? "-1"
          : kbToBytes(downloadKb);

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          downloadRoot,
          uploadLimit,
          downloadLimit,
          speedUnlimited: unlimited ? "1" : "0",
          theme,
          scanCron,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const data = (await res.json()) as {
        lastScanAt?: string;
        scanCron?: string;
      };
      if (data.scanCron) setScanCron(data.scanCron);
      if (data.lastScanAt) setLastScanAt(data.lastScanAt);
      setMessage("Saved — speed limits applied to active downloads");
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

      <div className="space-y-3 rounded-2xl border border-accent/30 bg-card/50 p-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Unlimited speeds</p>
            <p className="text-xs text-muted-foreground">
              When on, upload and download have no caps
            </p>
          </div>
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
            className="size-5 accent-[var(--accent)]"
          />
        </label>

        {!unlimited ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="uploadKb">Upload (KB/s)</Label>
              <Input
                id="uploadKb"
                type="number"
                min={0}
                value={uploadKb}
                onChange={(e) => setUploadKb(e.target.value)}
                className="border-accent/35 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                <span className="font-mono text-accent">0</span> = no upload
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="downloadKb">Download (KB/s)</Label>
              <Input
                id="downloadKb"
                type="number"
                min={0}
                value={downloadKb}
                onChange={(e) => setDownloadKb(e.target.value)}
                placeholder="unlimited"
                className="border-accent/35 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Empty = unlimited download
              </p>
            </div>
          </div>
        ) : null}
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
          Default <span className="font-mono text-accent">* * * * *</span> = every minute.
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
