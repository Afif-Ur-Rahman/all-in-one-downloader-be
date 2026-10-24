import youtubeDl from "youtube-dl-exec";

import { detectPlatform } from "@/constants/platforms";
import { statusCodes } from "@/constants/statusCodes";
import { AppError } from "@/utils/app-error";
import { formatBytes, formatDuration } from "@/utils/format";

import type { VideoFormat, VideoInfo } from "./types";

type RawFormat = {
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

type RawInfo = {
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  formats?: RawFormat[];
};

const isVideoFormat = (format: RawFormat) =>
  format.vcodec != null && format.vcodec !== "none" && !!format.height;

const isAudioOnly = (format: RawFormat) =>
  format.vcodec === "none" && format.acodec != null && format.acodec !== "none";

const hasAudioTrack = (format: RawFormat) => format.acodec != null && format.acodec !== "none";

// Prefer H.264 (plays everywhere), then MP4, then higher bitrate
const score = (format: RawFormat) =>
  (format.vcodec?.startsWith("avc") ? 2000000 : 0) +
  (format.ext === "mp4" ? 1000000 : 0) +
  (format.tbr ?? 0);

const sizeLabel = (format: RawFormat): string => {
  if (format.filesize) return formatBytes(format.filesize);
  if (format.filesize_approx) return `~${formatBytes(format.filesize_approx)}`;
  return "—";
};

const buildVideoFormats = (formats: RawFormat[]): VideoFormat[] => {
  const byHeight = new Map<number, RawFormat>();

  formats.filter(isVideoFormat).forEach((format) => {
    const height = format.height as number;
    const current = byHeight.get(height);
    if (!current || score(format) > score(current)) byHeight.set(height, format);
  });

  return [...byHeight.entries()]
    .sort(([a], [b]) => b - a)
    .map(([height, format]) => ({
      id: format.format_id,
      kind: "video" as const,
      quality: `${height}p`,
      extension: format.ext.toUpperCase(),
      size: sizeLabel(format),
      hasAudio: hasAudioTrack(format),
    }));
};

const buildAudioFormats = (formats: RawFormat[]): VideoFormat[] => {
  const best = formats
    .filter(isAudioOnly)
    .sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0))[0];

  // MP3 is always offered: the download step converts it with ffmpeg
  const audio: VideoFormat[] = [
    { id: "mp3", kind: "audio", quality: "High", extension: "MP3", size: "—", hasAudio: true },
  ];

  if (best) {
    audio.push({
      id: best.format_id,
      kind: "audio",
      quality: "Original",
      extension: best.ext.toUpperCase(),
      size: sizeLabel(best),
      hasAudio: true,
    });
  }

  return audio;
};

export const fetchVideoInfo = async (url: string): Promise<VideoInfo> => {
  const platform = detectPlatform(url);

  if (!platform) {
    throw new AppError("This link is not from a supported platform", statusCodes.BAD_REQUEST);
  }

  let raw: RawInfo;

  try {
    raw = (await youtubeDl(
      url,
      { dumpSingleJson: true, noWarnings: true, noPlaylist: true },
      { timeout: 30000 },
    )) as unknown as RawInfo;
  } catch (error) {
    if ((error as { timedOut?: boolean }).timedOut) {
      throw new AppError(
        "The platform took too long to respond. Please try again.",
        statusCodes.GATEWAY_TIMEOUT,
      );
    }

    console.error(`[yt-dlp] failed for ${url}`, error);
    throw new AppError(
      "We couldn't fetch this video. Check that the link is correct and the video is public.",
      statusCodes.UNPROCESSABLE_ENTITY,
    );
  }

  const formats = raw.formats ?? [];

  return {
    title: raw.title ?? "Untitled video",
    author: raw.uploader ?? raw.channel ?? "Unknown",
    platform: platform.name,
    duration: raw.duration ? formatDuration(raw.duration) : "--:--",
    thumbnail: raw.thumbnail ?? null,
    formats: [...buildVideoFormats(formats), ...buildAudioFormats(formats)],
  };
};
