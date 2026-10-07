/**
 * Extra public trackers merged into every add (torrent + magnet).
 * More announce URLs = more peer candidates (what qBittorrent does via its tracker list).
 */
export const FALLBACK_ANNOUNCE = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://explodie.org:6969/announce",
  "udp://tracker-udp.gbitt.info:80/announce",
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.tiny-vps.com:6969/announce",
  "udp://tracker.moeking.me:6969/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.theoks.net:6969/announce",
  "http://tracker.openbittorrent.com:80/announce",
  "http://tracker.opentrackr.org:1337/announce",
  "https://tracker.nanoha.org:443/announce",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.btorrent.xyz",
  "wss://tracker.webtorrent.dev",
] as const;

/** Ask trackers for as many peers as they allow (default is only 50). */
export const ANNOUNCE_NUMWANT = 200;

/** Re-announce more often than the BitTorrent default (~15–30 min). */
export const ANNOUNCE_INTERVAL_MS = 60_000;

export type SwarmStats = {
  seeds: number;
  leechers: number;
  updatedAt: number;
};

export type ConnectedPeerView = {
  address: string;
  kind: string;
  source: string;
  downloadSpeed: number;
  uploadSpeed: number;
};

const SOURCE_LABEL: Record<string, string> = {
  tracker: "Tracker",
  dht: "DHT",
  lsd: "LAN",
  ut_pex: "PEX",
  manual: "Manual",
};

type WireLike = {
  remoteAddress?: string;
  remotePort?: number;
  type?: string;
  downloadSpeed?: () => number;
  uploadSpeed?: () => number;
};

type PeerLike = {
  id: string;
  source?: string | null;
  type?: string;
  connected?: boolean;
  wire?: WireLike | null;
};

type TorrentWithPeers = {
  wires?: WireLike[];
  _peers?: Map<string, PeerLike>;
};

function peerFromWire(wire: WireLike, meta?: PeerLike): ConnectedPeerView {
  const host = wire.remoteAddress?.trim();
  const address = host
    ? `${host}${wire.remotePort ? `:${wire.remotePort}` : ""}`
    : (meta?.id ?? "active connection");
  const sourceKey = meta?.source ?? "unknown";
  return {
    address,
    kind: wire.type ?? meta?.type ?? "peer",
    source: SOURCE_LABEL[sourceKey] ?? sourceKey,
    downloadSpeed:
      typeof wire.downloadSpeed === "function" ? wire.downloadSpeed() : 0,
    uploadSpeed:
      typeof wire.uploadSpeed === "function" ? wire.uploadSpeed() : 0,
  };
}

export function readConnectedPeers(torrent: unknown): ConnectedPeerView[] {
  const raw = torrent as TorrentWithPeers & { numPeers?: number };
  const wires = Array.isArray(raw.wires) ? raw.wires : [];
  const peerByWire = new Map<WireLike, PeerLike>();
  const peerMap = raw._peers instanceof Map ? raw._peers : null;

  if (peerMap) {
    for (const peer of peerMap.values()) {
      if (peer.wire) peerByWire.set(peer.wire, peer);
    }
  }

  if (wires.length > 0) {
    return wires.map((wire) => peerFromWire(wire, peerByWire.get(wire)));
  }

  const fromPeers: ConnectedPeerView[] = [];
  if (peerMap) {
    for (const peer of peerMap.values()) {
      if (!peer.connected && !peer.wire) continue;
      if (peer.wire) {
        fromPeers.push(peerFromWire(peer.wire, peer));
        continue;
      }
      const sourceKey = peer.source ?? "unknown";
      fromPeers.push({
        address: peer.id,
        kind: peer.type ?? "peer",
        source: SOURCE_LABEL[sourceKey] ?? sourceKey,
        downloadSpeed: 0,
        uploadSpeed: 0,
      });
    }
  }

  return fromPeers;
}

/** Keep the best seed/leecher counts seen across trackers (not the last announce). */
export function mergeSwarmStats(
  prev: SwarmStats | undefined,
  next: { complete?: number; incomplete?: number },
): SwarmStats {
  const seeds = Math.max(prev?.seeds ?? 0, next.complete ?? 0);
  const leechers = Math.max(prev?.leechers ?? 0, next.incomplete ?? 0);
  return { seeds, leechers, updatedAt: Date.now() };
}

export function isBenignTorrentWarning(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("no nodes to query") ||
    lower.includes("fetch failed") ||
    // Announces and web seed requests in flight when the torrent is destroyed.
    lower.includes("operation was aborted") ||
    lower.includes("http error from xs param") ||
    lower.includes("non-200 status code") ||
    (lower.includes("tracker") && lower.includes("timed out"))
  );
}
