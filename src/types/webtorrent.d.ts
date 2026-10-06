declare module "webtorrent" {
  export interface TorrentFile {
    name: string;
    length: number;
  }

  export interface Torrent {
    destroyed?: boolean;
    infoHash: string;
    name: string;
    length: number;
    downloaded: number;
    downloadSpeed: number;
    uploadSpeed: number;
    progress: number;
    numPeers: number;
    files: TorrentFile[];
    destroy: (opts?: { destroyStore?: boolean }, cb?: () => void) => void;
    on: (event: string, cb: (...args: unknown[]) => void) => void;
    pause: () => void;
    resume: () => void;
  }

  export interface WebTorrentOptions {
    maxConns?: number;
    torrentPort?: number;
    dhtPort?: number;
    dht?: boolean | Record<string, unknown>;
    tracker?: boolean | Record<string, unknown>;
    lsd?: boolean;
    utPex?: boolean;
    natUpnp?: boolean | "permanent";
    natPmp?: boolean;
    utp?: boolean;
    webSeeds?: boolean;
    seedOutgoingConnections?: boolean;
    secure?: number;
    /** bytes/sec, -1 = unlimited */
    uploadLimit?: number;
    /** bytes/sec, -1 = unlimited */
    downloadLimit?: number;
  }

  export interface AddOptions {
    path?: string;
    strategy?: "rarest" | "sequential";
    storeCacheSlots?: number;
    maxWebConns?: number;
    noPeersIntervalTime?: number;
    uploads?: number;
    announce?: string[];
  }

  export default class WebTorrent {
    constructor(opts?: WebTorrentOptions);
    add(
      torrentId: string | Buffer | Uint8Array,
      opts?: AddOptions,
      callback?: (torrent: Torrent) => void,
    ): Torrent;
    get(torrentId: string): Promise<Torrent | null> | Torrent | void;
    remove(
      torrentId: string,
      opts?: { destroyStore?: boolean },
      cb?: (err?: Error) => void,
    ): void;
    destroy(cb?: (err?: Error) => void): void;
    throttleUpload(rate: number): void;
    throttleDownload(rate: number): void;
    torrents: Torrent[];
  }
}

declare module "parse-torrent" {
  interface ParsedTorrent {
    infoHash?: string;
    name?: string;
    length?: number;
  }

  function parseTorrent(
    torrentId: Buffer | Uint8Array | string,
  ): Promise<ParsedTorrent>;
  export default parseTorrent;
}
