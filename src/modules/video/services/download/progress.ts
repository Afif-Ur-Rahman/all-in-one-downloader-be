import { formatBytes, formatDuration } from "@/utils";

import { PROGRESS_PREFIX } from "./constants";

import type { Job, ProgressEvent, StreamName } from "./types";

type OverallProgress = Pick<ProgressEvent, "overallPercent" | "overallLoaded" | "overallTotal">;

const toNumber = (value: string | undefined): number | null => {
  if (!value || value === "NA" || value === "None") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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

const mergingEvent = (job: Job, message: string): ProgressEvent => {
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
    message,
  };
};

export const parseProgressLine = (line: string, job: Job): ProgressEvent | null => {
  const trimmed = line.trim();

  if (trimmed.startsWith(`${PROGRESS_PREFIX}|`)) {
    return parseTemplateLine(trimmed, job);
  }

  if (/^\s*\[Merger\]|\[VideoRemuxer\]|Merging formats into/i.test(line)) {
    return mergingEvent(job, "Merging media…");
  }

  if (/\[ExtractAudio\]|\[FFmpegExtractAudio\]|\[ffmpeg\]/i.test(line)) {
    return mergingEvent(job, "Processing media…");
  }

  return null;
};
