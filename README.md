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

## PWA

Installable as a home-screen app (standalone display):

- Manifest: `/manifest.webmanifest`
- Icons: `public/icons/`
- Minimal service worker: `public/sw.js` (network-only; does not cache API/media)

**Note:** On a phone over plain `http://192.168.x.x`, iOS “Add to Home Screen” usually works. Android Chrome’s Install prompt often requires **HTTPS** (or `localhost`). For LAN HTTPS later, put a reverse proxy (Caddy/nginx) in front.

## Stack

Next.js · SQLite (`node:sqlite`) · WebTorrent · node-cron · shadcn/ui · Tailwind · PWA
