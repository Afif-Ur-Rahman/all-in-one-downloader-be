import { mkdtemp, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import ffmpegPath from "ffmpeg-static";
import youtubeDl from "youtube-dl-exec";

import { detectPlatform, statusCodes } from "@/constants";
import { AppError } from "@/utils";

export type DownloadKind = "video" | "audio";

export type PreparedDownload = {
  filePath: string;
  fileName: string;
  cleanup: () => Promise<void>;
};

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_FILE_SIZE = "500M";

export const prepareDownload = async (
  url: string,
  formatId: string,
  kind: DownloadKind,
): Promise<PreparedDownload> => {
  if (!detectPlatform(url)) {
    throw new AppError("This link is not from a supported platform", statusCodes.BAD_REQUEST);
  }

  const dir = await mkdtemp(path.join(tmpdir(), "aio-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });

  const baseFlags = {
    noPlaylist: true,
    noWarnings: true,
    restrictFilenames: true,
    maxFilesize: MAX_FILE_SIZE,
    output: path.join(dir, "%(title).80s.%(ext)s"),
    ffmpegLocation: ffmpegPath ?? undefined,
  };

  const flags =
    kind === "audio"
      ? formatId === "mp3"
        ? {
            ...baseFlags,
            format: "bestaudio/best",
            extractAudio: true,
            audioFormat: "mp3",
            audioQuality: "192K",
          }
        : { ...baseFlags, format: formatId }
      : {
          ...baseFlags,
          format: `${formatId}+bestaudio/${formatId}`,
          mergeOutputFormat: "mp4",
        };

  try {
    await youtubeDl(url, flags, { timeout: DOWNLOAD_TIMEOUT_MS });

    const files = await readdir(dir);
    const fileName = files.find((file) => !/\.(part|ytdl|temp)$/i.test(file));

    if (!fileName) {
      throw new Error("No output file was produced");
    }

    return { filePath: path.join(dir, fileName), fileName, cleanup };
  } catch (error) {
    await cleanup();

    if ((error as { timedOut?: boolean }).timedOut) {
      throw new AppError(
        "The download took too long. Please try a lower quality.",
        statusCodes.GATEWAY_TIMEOUT,
      );
    }

    console.error(`[yt-dlp] download failed for ${url} (${formatId})`, error);
    throw new AppError(
      "We couldn't download this format. Try another quality.",
      statusCodes.UNPROCESSABLE_ENTITY,
    );
  }
};
