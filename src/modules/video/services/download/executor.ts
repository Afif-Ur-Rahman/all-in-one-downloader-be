import youtubeDl from "youtube-dl-exec";

import { DOWNLOAD_TIMEOUT_MS } from "./constants";
import { buildJobFlags } from "./flags";
import { findOutputFile } from "./output";
import { parseProgressLine } from "./progress";
import { jobs } from "./store";

import type { DownloadProcess, Job, JobProgress } from "./types";

export const executeJob = async (job: Job, onProgress: JobProgress) => {
  try {
    const subprocess = youtubeDl.exec(job.url, buildJobFlags(job), {
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

    const output = await findOutputFile(job.directory);

    job.status = "ready";
    job.filePath = output.filePath;
    job.fileName = output.fileName;
    job.process = null;

    onProgress({
      phase: "ready",
      stream: "merge",
      streamPercent: 100,
      streamLoaded: output.size,
      streamTotal: output.size,
      speed: null,
      eta: null,
      overallPercent: 100,
      overallLoaded: output.size,
      overallTotal: output.size,
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
