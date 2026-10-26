import type { PlatformService } from "../../platforms";

export type DownloadKind = "video" | "audio";
export type StreamName = "video" | "audio" | "merge";

export type ProgressEvent = {
  phase: "preparing" | "merging" | "ready" | "error";
  stream: StreamName | null;
  streamPercent: number | null;
  streamLoaded: number | null;
  streamTotal: number | null;
  speed: string | null;
  eta: string | null;
  overallPercent: number | null;
  overallLoaded: number | null;
  overallTotal: number | null;
  message?: string;
};

export type JobProgress = (event: ProgressEvent) => void;

export type PreparedDownload = {
  filePath: string;
  fileName: string;
  cleanup: () => Promise<void>;
};

export type DownloadProcess = {
  kill?: (signal?: NodeJS.Signals) => void;
};

export type Job = {
  id: string;
  service: PlatformService;
  status: "running" | "paused" | "ready" | "error";
  url: string;
  directory: string;
  filePath?: string;
  fileName?: string;
  error?: string;
  cleanup: () => Promise<void>;
  createdAt: number;
  kind: DownloadKind;
  formatId: string;
  mergeStarted: boolean;
  estimatedSize: number | null;
  streamBytes: Map<string, number>;
  process: DownloadProcess | null;
};
