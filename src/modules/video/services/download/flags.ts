import path from "path";

import ffmpegPath from "ffmpeg-static";

import { MAX_FILE_SIZE, PROGRESS_TEMPLATE } from "./constants";

import type { Job } from "./types";

export const buildJobFlags = (job: Job): Record<string, unknown> => ({
  noPlaylist: true,
  noWarnings: true,
  restrictFilenames: true,
  maxFilesize: MAX_FILE_SIZE,
  output: path.join(job.directory, "%(title).80s.%(ext)s"),
  ffmpegLocation: ffmpegPath ?? undefined,
  newline: true,
  progress: true,
  progressTemplate: PROGRESS_TEMPLATE,

  // This allows yt-dlp to continue from .part / .ytdl files after pause.
  continue: true,

  // Format selection is platform specific, so the platform service decides it.
  ...job.service.getDownloadFlags({ formatId: job.formatId, kind: job.kind }),
});
