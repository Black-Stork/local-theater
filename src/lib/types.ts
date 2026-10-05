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
  peers: number;
  savePath: string;
  magnet: string | null;
  error: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  categoryName: string;
};
