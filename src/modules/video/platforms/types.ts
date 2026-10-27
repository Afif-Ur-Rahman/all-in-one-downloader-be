import { VideoInfo } from "./shared";

export type DownloadKind = "video" | "audio";

export type DownloadFlagsContext = {
  formatId: string;
  kind: DownloadKind;
};

export type PlatformService = {
  id: string;
  getInfo: (url: string) => Promise<VideoInfo>;
  getDownloadFlags: (context: DownloadFlagsContext) => Record<string, unknown>;
};
