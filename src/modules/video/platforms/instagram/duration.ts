import { execFile } from "child_process";

import ffmpegPath from "ffmpeg-static";

import type { RawFormat } from "../shared";

const DURATION_PATTERN = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/;

const probeDuration = (url: string): Promise<number | undefined> =>
  new Promise((resolve) => {
    if (!ffmpegPath) {
      resolve(undefined);
      return;
    }

    execFile(
      ffmpegPath,
      ["-hide_banner", "-i", url],
      { timeout: 15_000 },
      (_error, _stdout, stderr) => {
        const match = DURATION_PATTERN.exec(stderr);

        resolve(
          match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : undefined,
        );
      },
    );
  });

export const resolveDuration = async (
  duration: number | undefined,
  formats: RawFormat[] = [],
): Promise<number | undefined> => {
  if (duration) return duration;

  const source =
    formats.find((format) => format.vcodec === "none" && format.url) ??
    formats.find((format) => format.url);

  return source?.url ? probeDuration(source.url) : undefined;
};
