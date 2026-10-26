import { randomUUID } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import { resolvePlatformService } from "../../platforms";

import { executeJob } from "./executor";
import { jobs } from "./store";

import type { DownloadKind, Job, JobProgress, PreparedDownload } from "./types";

export const startDownloadJob = async (
  url: string,
  formatId: string,
  kind: DownloadKind,
  estimatedSize: number | null,
  onProgress: JobProgress,
): Promise<string> => {
  const service = resolvePlatformService(url);

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
    service,
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
