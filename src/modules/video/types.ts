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
