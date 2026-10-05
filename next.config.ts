import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["webtorrent", "parse-torrent", "node-cron"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
