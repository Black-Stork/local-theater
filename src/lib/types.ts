import type { ConnectedPeerView } from "@/lib/torrent-peers";

export type TorrentView = {
  id: string;
  name: string;
  infoHash: string | null;
  categoryId: string;
  status: string;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  downloaded: number;
  total: number;
  /** Active BitTorrent connections right now (not total swarm size). */
  peers: number;
  /** Seeds reported by the last tracker announce, when available. */
  swarmSeeds: number | null;
  /** Leechers reported by the last tracker announce, when available. */
  swarmLeechers: number | null;
  connectedPeers: ConnectedPeerView[];
  /** Final ReadySHARE / category folder. */
  savePath: string;
  /** Local Mac path while downloading (null when finished / not staging). */
  stagingPath: string | null;
  /**
   * Bytes already moved to ReadySHARE while status is `promoting`.
   * Null when not currently copying.
   */
  promoteBytes: number | null;
  /** Total bytes being moved to ReadySHARE while status is `promoting`. */
  promoteTotal: number | null;
  magnet: string | null;
  error: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  categoryName: string;
};
