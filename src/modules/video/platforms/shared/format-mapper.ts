import { formatBytes, formatDuration } from "@/utils/format";

import type { RawFormat, RawInfo, VideoFormat, VideoInfo } from "./types";

const isVideoFormat = (format: RawFormat): boolean =>
  format.vcodec != null && format.vcodec !== "none" && !!format.height;

const isAudioOnly = (format: RawFormat): boolean =>
  format.vcodec === "none" && format.acodec != null && format.acodec !== "none";

const hasAudioTrack = (format: RawFormat): boolean =>
  format.acodec != null && format.acodec !== "none";

const score = (format: RawFormat): number =>
  (format.vcodec?.startsWith("avc") ? 2_000_000 : 0) +
  (format.ext === "mp4" ? 1_000_000 : 0) +
  (format.tbr ?? 0);

const sizeLabel = (format: RawFormat, duration?: number): string => {
  if (format.filesize) return formatBytes(format.filesize);

  if (format.filesize_approx) {
    return `~${formatBytes(format.filesize_approx)}`;
  }

  if (format.tbr && duration) {
    return `~${formatBytes(((format.tbr * 1000) / 8) * duration)}`;
  }

  return "—";
};

const resolution = (format: RawFormat): number =>
  format.width && format.height ? Math.min(format.width, format.height) : (format.height as number);

export const buildVideoFormats = (formats: RawFormat[], duration?: number): VideoFormat[] => {
  const byResolution = new Map<number, RawFormat>();

  formats.filter(isVideoFormat).forEach((format) => {
    const value = resolution(format);
    const current = byResolution.get(value);

    if (!current || score(format) > score(current)) {
      byResolution.set(value, format);
    }
  });

  return [...byResolution.entries()]
    .sort(([a], [b]) => b - a)
    .map(([value, format]) => ({
      id: format.format_id,
      kind: "video" as const,
      quality: `${value}p`,
      extension: format.ext.toUpperCase(),
      size: sizeLabel(format, duration),
      hasAudio: hasAudioTrack(format),
    }));
};

export const buildAudioFormats = (formats: RawFormat[], duration?: number): VideoFormat[] => {
  const best = formats
    .filter(isAudioOnly)
    .sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0))[0];

  const audio: VideoFormat[] = [
    {
      id: "mp3",
      kind: "audio",
      quality: "High",
      extension: "MP3",
      size: duration ? `~${formatBytes(((192 * 1000) / 8) * duration)}` : "—",
      hasAudio: true,
    },
  ];

  if (best) {
    audio.push({
      id: best.format_id,
      kind: "audio",
      quality: "Original",
      extension: best.ext.toUpperCase(),
      size: sizeLabel(best, duration),
      hasAudio: true,
    });
  }

  return audio;
};

export const toVideoInfo = (raw: RawInfo, platformName: string): VideoInfo => {
  const formats = raw.formats ?? [];

  return {
    title: raw.title ?? "Untitled video",
    author: raw.uploader ?? raw.channel ?? "Unknown",
    platform: platformName,
    duration: raw.duration ? formatDuration(raw.duration) : "--:--",
    thumbnail: raw.thumbnail ?? null,
    formats: [
      ...buildVideoFormats(formats, raw.duration),
      ...buildAudioFormats(formats, raw.duration),
    ],
  };
};
