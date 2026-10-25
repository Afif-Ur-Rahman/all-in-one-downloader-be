import { randomUUID } from "crypto";
import { mkdtemp, readdir, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import ffmpegPath from "ffmpeg-static";
import youtubeDl from "youtube-dl-exec";

import { detectPlatform, statusCodes } from "@/constants";
import { AppError } from "@/utils";

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
  message?: string;
};

export type PreparedDownload = {
  filePath: string;
  fileName: string;
  cleanup: () => Promise<void>;
};

type Job = {
  id: string;
  status: "running" | "ready" | "error";
  filePath?: string;
  fileName?: string;
  error?: string;
  cleanup: () => Promise<void>;
  createdAt: number;
  kind: DownloadKind;
  streamIndex: number;
  currentStreamTotal: number | null;
  lastPercent: number | null;
  mergeStarted: boolean;
};

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_FILE_SIZE = "500M";
const JOB_TTL_MS = 10 * 60 * 1000;

const jobs = new Map<string, Job>();

setInterval(() => {
  const now = Date.now();

  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      void job.cleanup();
      jobs.delete(id);
    }
  }
}, 60_000).unref();

const parseSizeToBytes = (raw: string): number | null => {
  const match = raw.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)$/i);

  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toUpperCase();

  const multiplier = unit.startsWith("T")
    ? 1024 ** 4
    : unit.startsWith("G")
      ? 1024 ** 3
      : unit.startsWith("M")
        ? 1024 ** 2
        : unit.startsWith("K")
          ? 1024
          : 1;

  return Math.round(value * multiplier);
};

const getStreamName = (job: Job): StreamName => {
  if (job.kind === "audio") return "audio";
  return job.streamIndex === 0 ? "video" : "audio";
};

const createProgressEvent = (
  stream: StreamName,
  percent: number,
  total: number | null,
  speed: string | null = null,
  eta: string | null = null,
): ProgressEvent => {
  const safePercent = Math.min(100, Math.max(0, percent));

  return {
    phase: stream === "merge" ? "merging" : "preparing",
    stream,
    streamPercent: safePercent,
    streamLoaded: total !== null ? Math.round((safePercent / 100) * total) : null,
    streamTotal: total,
    speed,
    eta,
  };
};

const updateStreamIndex = (percent: number, job: Job) => {
  // Detect the start of the audio stream after the video stream finishes.
  if (
    job.kind === "video" &&
    job.streamIndex === 0 &&
    job.lastPercent !== null &&
    job.lastPercent >= 99 &&
    percent < 10
  ) {
    job.streamIndex = 1;
    job.currentStreamTotal = null;
  }

  job.lastPercent = percent;
};

const parseProgressLine = (line: string, job: Job): ProgressEvent | null => {
  const progressMatch = line.match(
    /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*([\d.]+\s*(?:B|KB|MB|GB|TB|KiB|MiB|GiB|TiB))(?:\s+at\s+([\d.]+\s*(?:B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)\/s))?(?:\s+ETA\s+([^\s]+))?/i,
  );

  if (progressMatch) {
    const percent = Number(progressMatch[1]);

    updateStreamIndex(percent, job);

    const stream = getStreamName(job);
    const reportedTotal = parseSizeToBytes(progressMatch[2]);

    // Always use the latest total reported by yt-dlp.
    job.currentStreamTotal = reportedTotal;

    return createProgressEvent(
      stream,
      percent,
      reportedTotal,
      progressMatch[3] ?? null,
      progressMatch[4] && progressMatch[4] !== "Unknown" ? progressMatch[4] : null,
    );
  }

  if (/^\s*\[Merger\]|\[VideoRemuxer\]|Merging formats into/i.test(line)) {
    job.mergeStarted = true;

    return {
      phase: "merging",
      stream: "merge",
      streamPercent: 0,
      streamLoaded: null,
      streamTotal: null,
      speed: null,
      eta: null,
      message: "Merging media…",
    };
  }

  if (/\[ExtractAudio\]|\[FFmpegExtractAudio\]|\[ffmpeg\]/i.test(line)) {
    job.mergeStarted = true;

    return {
      phase: "merging",
      stream: "merge",
      streamPercent: 0,
      streamLoaded: null,
      streamTotal: null,
      speed: null,
      eta: null,
      message: "Processing media…",
    };
  }

  return null;
};

export const startDownloadJob = async (
  url: string,
  formatId: string,
  kind: DownloadKind,
  onProgress: (event: ProgressEvent) => void,
): Promise<string> => {
  if (!detectPlatform(url)) {
    throw new AppError("This link is not from a supported platform", statusCodes.BAD_REQUEST);
  }

  const id = randomUUID();
  const directory = await mkdtemp(path.join(tmpdir(), "aio-"));

  const cleanup = async () => {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures.
    }
  };

  const job: Job = {
    id,
    status: "running",
    cleanup,
    createdAt: Date.now(),
    kind,
    streamIndex: 0,
    currentStreamTotal: null,
    lastPercent: null,
    mergeStarted: false,
  };

  jobs.set(id, job);

  const baseFlags = {
    noPlaylist: true,
    noWarnings: true,
    restrictFilenames: true,
    maxFilesize: MAX_FILE_SIZE,
    output: path.join(directory, "%(title).80s.%(ext)s"),
    ffmpegLocation: ffmpegPath ?? undefined,
    newline: true,
    progress: true,
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
        : {
            ...baseFlags,
            format: formatId,
          }
      : {
          ...baseFlags,
          format: `${formatId}+bestaudio/${formatId}`,
          mergeOutputFormat: "mp4",
        };

  void (async () => {
    try {
      const subprocess = youtubeDl.exec(url, flags, {
        timeout: DOWNLOAD_TIMEOUT_MS,
      });

      let buffer = "";

      const handleChunk = (chunk: Buffer | string) => {
        buffer += chunk.toString();

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const event = parseProgressLine(line, job);
          if (event) onProgress(event);
        }
      };

      subprocess.stdout?.on("data", handleChunk);
      subprocess.stderr?.on("data", handleChunk);

      await subprocess;

      if (buffer.trim()) {
        const event = parseProgressLine(buffer, job);
        if (event) onProgress(event);
      }

      const files = await readdir(directory);
      const fileName = files.find((file) => !/\.(?:part|ytdl|temp)$/i.test(file));

      if (!fileName) {
        throw new Error("No output file was produced");
      }

      const filePath = path.join(directory, fileName);
      const fileInfo = await stat(filePath);

      if (!fileInfo.isFile() || fileInfo.size === 0) {
        throw new Error("Empty file");
      }

      job.status = "ready";
      job.filePath = filePath;
      job.fileName = fileName;

      onProgress({
        phase: "ready",
        stream: "merge",
        streamPercent: 100,
        streamLoaded: fileInfo.size,
        streamTotal: fileInfo.size,
        speed: null,
        eta: null,
      });
    } catch (error) {
      job.status = "error";
      job.error = (error as { timedOut?: boolean })?.timedOut
        ? "The download took too long. Please try a lower quality."
        : "We couldn't download this format. Try another quality.";

      onProgress({
        phase: "error",
        stream: null,
        streamPercent: null,
        streamLoaded: null,
        streamTotal: null,
        speed: null,
        eta: null,
        message: job.error,
      });

      await cleanup();
      jobs.delete(id);
    }
  })();

  return id;
};

export const getJob = (id: string) => jobs.get(id);

export const takeJobFile = (id: string): PreparedDownload | null => {
  const job = jobs.get(id);

  if (!job || job.status !== "ready" || !job.filePath || !job.fileName) {
    return null;
  }

  return {
    filePath: job.filePath,
    fileName: job.fileName,
    cleanup: async () => {
      await job.cleanup();
      jobs.delete(id);
    },
  };
};
