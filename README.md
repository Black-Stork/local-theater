# Local Bay

LAN torrent downloader UI. Open from your phone on the same Wi‑Fi, upload a `.torrent` or magnet, watch progress, and save into category folders on ReadySHARE.

## Run

```bash
npm install
npm run dev
```

App listens on **http://0.0.0.0:7887** (all interfaces, port `7887`).

On your phone: `http://<your-mac-lan-ip>:7887`

## Defaults

- Download root: `/Volumes/9D41DB26/Downloads`
- Categories: `Movies`, `Shows`
- Upload limit: `0` bytes/sec
- Theme: Ember (orange). Switch to Signal (mint) in Settings.
- Folder scanner: `node-cron` every minute (`* * * * *`), configurable in Settings

## Stack

Next.js · SQLite (`node:sqlite`) · WebTorrent · node-cron · shadcn/ui · Tailwind
