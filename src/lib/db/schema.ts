export type Category = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

export type TorrentRow = {
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
  peers: number;
  savePath: string;
  magnet: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};
