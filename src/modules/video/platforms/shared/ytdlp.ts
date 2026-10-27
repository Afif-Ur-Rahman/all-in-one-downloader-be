import youtubeDl from "youtube-dl-exec";

import { statusCodes } from "@/constants/statusCodes";
import { AppError } from "@/utils/app-error";
import { formatBytes, formatDuration } from "@/utils/format";

import {
  activatePlatformCookies,
  areCookiesDisabled,
  disablePlatformCookies,
} from "./platform-auth";

import type { VideoFormat, VideoInfo } from "../../types";

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

type FetchRawInfoOptions = {
  platformName?: string;
};

const ACCOUNT_FLAG_PATTERNS = [
  /login/i,
  /log in/i,
  /sign in/i,
  /checkpoint/i,
  /account.*locked/i,
  /account.*disabled/i,
  /session expired/i,
  /cookies.*no longer valid/i,
  /confirm your identity/i,
  /security check/i,
  /not logged in/i,
];

const isAccountFlagError = (message: string): boolean =>
  ACCOUNT_FLAG_PATTERNS.some((pattern) => pattern.test(message));

const isVideoFormat = (format: RawFormat) =>
  format.vcodec != null && format.vcodec !== "none" && !!format.height;

const isAudioOnly = (format: RawFormat) =>
  format.vcodec === "none" && format.acodec != null && format.acodec !== "none";

const hasAudioTrack = (format: RawFormat) => format.acodec != null && format.acodec !== "none";

const score = (format: RawFormat) =>
  (format.vcodec?.startsWith("avc") ? 2000000 : 0) +
  (format.ext === "mp4" ? 1000000 : 0) +
  (format.tbr ?? 0);

const sizeLabel = (format: RawFormat, duration?: number): string => {
  if (format.filesize) return formatBytes(format.filesize);
  if (format.filesize_approx) return `~${formatBytes(format.filesize_approx)}`;
  if (format.tbr && duration) {
    return `~${formatBytes(((format.tbr * 1000) / 8) * duration)}`;
  }
  return "—";
};

export const buildVideoFormats = (formats: RawFormat[], duration?: number): VideoFormat[] => {
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

const AUTH_ERROR_PATTERNS = [
  /login/i,
  /log in/i,
  /sign in/i,
  /signin/i,
  /checkpoint/i,
  /account.*locked/i,
  /account.*disabled/i,
  /session expired/i,
  /cookies.*no longer valid/i,
  /confirm your identity/i,
  /security check/i,
  /not logged in/i,
  /confirm you.?re not a bot/i,
];

const isAuthError = (message: string): boolean =>
  AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const fetchRawInfo = async (
  url: string,
  flags: Record<string, unknown> = {},
  options: FetchRawInfoOptions = {},
): Promise<RawInfo> => {
  const platformName = options.platformName ?? "Platform";

  try {
    return (await youtubeDl(
      url,
      { dumpSingleJson: true, noWarnings: true, noPlaylist: true, ...flags },
      { timeout: 30000 },
    )) as unknown as RawInfo;
  } catch (error) {
    if ((error as { timedOut?: boolean }).timedOut) {
      throw new AppError(
        "The platform took too long to respond. Please try again.",
        statusCodes.GATEWAY_TIMEOUT,
      );
    }

    const rawMessage = error instanceof Error ? error.message : String(error);

    if (isAccountFlagError(rawMessage)) {
      disablePlatformCookies(platformName, "Login, checkpoint, or account-flag response detected.");

      throw new AppError(
        `${platformName} is requiring verification. Cookie-based access was disabled automatically.`,
        statusCodes.UNPROCESSABLE_ENTITY,
      );
    }

    console.error(`[yt-dlp] failed for ${url}`, error);

    throw new AppError(
      "We couldn't fetch this video. Check that the link is correct and the video is public.",
      statusCodes.UNPROCESSABLE_ENTITY,
    );
  }
};

type FetchWithCookieFallbackOptions = {
  platformName: string;
  baseFlags: Record<string, unknown>;
  cookieFlags: Record<string, unknown>;
};

export const fetchRawInfoWithCookieFallback = async (
  url: string,
  { platformName, baseFlags, cookieFlags }: FetchWithCookieFallbackOptions,
): Promise<RawInfo> => {
  try {
    return await fetchRawInfo(url, baseFlags);
  } catch (firstError) {
    const firstMessage = getErrorMessage(firstError);

    if (!isAuthError(firstMessage)) {
      throw firstError;
    }

    const hasCookies = Boolean(cookieFlags.cookies);

    if (!hasCookies || areCookiesDisabled(platformName)) {
      throw firstError;
    }

    console.warn(`[${platformName}] Auth error without cookies. Retrying with cookies.`);

    try {
      const result = await fetchRawInfo(url, cookieFlags);

      activatePlatformCookies(platformName);

      return result;
    } catch (cookieError) {
      const cookieMessage = getErrorMessage(cookieError);

      if (isAuthError(cookieMessage)) {
        disablePlatformCookies(
          platformName,
          "Cookie retry also received an auth, checkpoint, or flag response.",
        );
      }

      throw cookieError;
    }
  }
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
