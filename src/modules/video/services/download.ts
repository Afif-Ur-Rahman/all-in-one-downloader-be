import { randomUUID } from "crypto";
import { mkdtemp, readdir, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import ffmpegPath from "ffmpeg-static";
import youtubeDl from "youtube-dl-exec";

import { detectPlatform, statusCodes } from "@/constants";
import { AppError, formatBytes, formatDuration } from "@/utils";

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

export type PreparedDownload = {
  filePath: string;
  fileName: string;
  cleanup: () => Promise<void>;
};

type DownloadProcess = {
  kill?: (signal?: NodeJS.Signals) => void;
};

type Job = {
  id: string;
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

type JobProgress = (event: ProgressEvent) => void;

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_FILE_SIZE = "500M";
const JOB_TTL_MS = 30 * 60 * 1000;

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

const PROGRESS_PREFIX = "AIOP";

const PROGRESS_TEMPLATE = [
  `download:${PROGRESS_PREFIX}`,
  "%(info.format_id)s",
  "%(progress.status)s",
  "%(progress.downloaded_bytes)s",
  "%(progress.total_bytes)s",
  "%(progress.total_bytes_estimate)s",
  "%(progress.fragment_index)s",
  "%(progress.fragment_count)s",
  "%(progress.speed)s",
  "%(progress.eta)s",
].join("|");

const toNumber = (value: string | undefined): number | null => {
  if (!value || value === "NA" || value === "None") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type OverallProgress = Pick<ProgressEvent, "overallPercent" | "overallLoaded" | "overallTotal">;

const getOverall = (job: Job): OverallProgress => {
  let loaded = 0;

  for (const bytes of job.streamBytes.values()) loaded += bytes;

  if (!job.estimatedSize) {
    return {
      overallPercent: null,
      overallLoaded: loaded,
      overallTotal: null,
    };
  }

  const total = Math.max(job.estimatedSize, loaded);

  return {
    overallPercent: Math.min(99, (loaded / total) * 100),
    overallLoaded: loaded,
    overallTotal: total,
  };
};

const parseTemplateLine = (line: string, job: Job): ProgressEvent | null => {
  const [
    ,
    formatId,
    status,
    downloaded,
    totalBytes,
    totalEstimate,
    fragmentIndexRaw,
    fragmentCountRaw,
    speedRaw,
    etaRaw,
  ] = line.split("|");

  const stream: StreamName =
    job.kind === "audio" ? "audio" : formatId === job.formatId ? "video" : "audio";

  const downloadedBytes = toNumber(downloaded);
  const exactTotal = toNumber(totalBytes);
  const estimatedTotal = toNumber(totalEstimate);
  const fragmentIndex = toNumber(fragmentIndexRaw);
  const fragmentCount = toNumber(fragmentCountRaw);
  const speed = toNumber(speedRaw);
  const eta = toNumber(etaRaw);

  const isFragmented = fragmentCount !== null && fragmentCount > 0 && fragmentIndex !== null;
  const finished = status === "finished";

  let percent = 0;

  if (finished) {
    percent = 100;
  } else if (isFragmented) {
    percent = (Math.max(0, (fragmentIndex as number) - 1) / (fragmentCount as number)) * 100;
  } else {
    const total = exactTotal ?? estimatedTotal;

    if (total && total > 0 && downloadedBytes !== null) {
      percent = (downloadedBytes / total) * 100;
    }
  }

  if (!finished) percent = Math.min(99, Math.max(0, percent));

  const reliableTotal =
    exactTotal ??
    (estimatedTotal !== null && (!isFragmented || (fragmentIndex as number) >= 3)
      ? estimatedTotal
      : null);

  if (downloadedBytes !== null) {
    job.streamBytes.set(formatId || stream, downloadedBytes);
  }

  const overall = getOverall(job);

  const overallEta =
    overall.overallTotal !== null && overall.overallLoaded !== null && speed !== null && speed > 0
      ? Math.max(0, overall.overallTotal - overall.overallLoaded) / speed
      : eta;

  return {
    phase: "preparing",
    stream,
    streamPercent: percent,
    streamLoaded: downloadedBytes,
    streamTotal: reliableTotal,
    speed: speed !== null && speed > 0 ? `${formatBytes(speed)}/s` : null,
    eta: overallEta !== null && overallEta > 0 ? formatDuration(overallEta) : null,
    ...overall,
  };
};

const parseProgressLine = (line: string, job: Job): ProgressEvent | null => {
  const trimmed = line.trim();

  if (trimmed.startsWith(`${PROGRESS_PREFIX}|`)) {
    return parseTemplateLine(trimmed, job);
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
      ...getOverall(job),
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
      ...getOverall(job),
      message: "Processing media…",
    };
  }

  return null;
};

const executeJob = async (job: Job, onProgress: JobProgress) => {
  const baseFlags = {
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
  };

  const flags =
    job.kind === "audio"
      ? job.formatId === "mp3"
        ? {
            ...baseFlags,
            format: "bestaudio/best",
            extractAudio: true,
            audioFormat: "mp3",
            audioQuality: "192K",
          }
        : {
            ...baseFlags,
            format: job.formatId,
          }
      : {
          ...baseFlags,
          format: `${job.formatId}+bestaudio/${job.formatId}`,
          mergeOutputFormat: "mp4",
        };

  try {
    const subprocess = youtubeDl.exec(job.url, flags, {
      timeout: DOWNLOAD_TIMEOUT_MS,
    });

    job.process = subprocess as unknown as DownloadProcess;

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

    if (job.status === "paused") return;

    const files = await readdir(job.directory);
    const fileName = files.find((file) => !/\.(?:part|ytdl|temp)$/i.test(file));

    if (!fileName) {
      throw new Error("No output file was produced");
    }

    const filePath = path.join(job.directory, fileName);
    const fileInfo = await stat(filePath);

    if (!fileInfo.isFile() || fileInfo.size === 0) {
      throw new Error("Empty file");
    }

    job.status = "ready";
    job.filePath = filePath;
    job.fileName = fileName;
    job.process = null;

    onProgress({
      phase: "ready",
      stream: "merge",
      streamPercent: 100,
      streamLoaded: fileInfo.size,
      streamTotal: fileInfo.size,
      speed: null,
      eta: null,
      overallPercent: 100,
      overallLoaded: fileInfo.size,
      overallTotal: fileInfo.size,
    });
  } catch (error) {
    if (job.status === "paused") return;

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
      overallPercent: null,
      overallLoaded: null,
      overallTotal: null,
      message: job.error,
    });

    await job.cleanup();
    jobs.delete(job.id);
  } finally {
    job.process = null;
  }
};

export const startDownloadJob = async (
  url: string,
  formatId: string,
  kind: DownloadKind,
  estimatedSize: number | null,
  onProgress: JobProgress,
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
    url,
    directory,
    cleanup,
    createdAt: Date.now(),
    kind,
    formatId,
    mergeStarted: false,
    estimatedSize,
    streamBytes: new Map(),
    process: null,
  };

  jobs.set(id, job);

  void executeJob(job, onProgress);

  return id;
};

export const pauseDownloadJob = (id: string): boolean => {
  const job = jobs.get(id);

  if (!job) return false;

  if (job.status !== "running" && job.status !== "ready") {
    return false;
  }

  if (job.status === "running") {
    try {
      job.process?.kill?.("SIGTERM");
    } catch {
      // Ignore kill failures.
    }
  }

  job.status = "paused";
  job.process = null;
  job.createdAt = Date.now();

  return true;
};

export const resumeDownloadJob = (id: string, onProgress: JobProgress): boolean => {
  const job = jobs.get(id);

  if (!job || job.status !== "paused") return false;

  job.createdAt = Date.now();

  if (job.filePath && job.fileName) {
    job.status = "ready";

    onProgress({
      phase: "ready",
      stream: "merge",
      streamPercent: 100,
      streamLoaded: null,
      streamTotal: null,
      speed: null,
      eta: null,
      overallPercent: 100,
      overallLoaded: null,
      overallTotal: null,
    });

    return true;
  }

  job.status = "running";

  void executeJob(job, onProgress);

  return true;
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
