export type VideoFormat = {
  id: string;
  kind: "video" | "audio";
  quality: string;
  extension: string;
  size: string;
  hasAudio: boolean;
};

export type VideoInfo = {
  title: string;
  author: string;
  platform: string;
  duration: string;
  thumbnail: string | null;
  formats: VideoFormat[];
};

export type RawFormat = {
  format_id: string;
  ext: string;
  vcodec?: string | null;
  acodec?: string | null;
  height?: number | null;
  abr?: number | null;
  tbr?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
};

export type RawInfo = {
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  formats?: RawFormat[];
};

export type FetchRawInfoOptions = {
  platformName?: string;
};

export type FetchWithCookieFallbackOptions = {
  platformName: string;
  baseFlags: Record<string, unknown>;
  cookieFlags: Record<string, unknown>;
};
