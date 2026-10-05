declare module "webtorrent" {
  export interface TorrentFile {
    name: string;
    length: number;
  }

  export interface Torrent {
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
    uploadLimit?: number;
    downloadLimit?: number;
  }

  export interface AddOptions {
    path?: string;
    strategy?: string;
  }

  export default class WebTorrent {
    constructor(opts?: WebTorrentOptions);
    add(
      torrentId: string | Buffer | Uint8Array,
      opts?: AddOptions,
      callback?: (torrent: Torrent) => void,
    ): Torrent;
    get(torrentId: string): Torrent | void;
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
