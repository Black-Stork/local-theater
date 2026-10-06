import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "webtorrent",
    "parse-torrent",
    "node-cron",
    "uuid",
  ],
  allowedDevOrigins: ["10.0.0.20", "localhost", "127.0.0.1"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
