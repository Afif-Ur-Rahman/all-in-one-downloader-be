import { statusCodes } from "@/constants/statusCodes";
import { catchAsync } from "@/utils";

import { downloadSchema, infoSchema } from "./schema";
import { fetchVideoInfo } from "./services";
import {
  getJob,
  pauseDownloadJob,
  resumeDownloadJob,
  startDownloadJob,
  takeJobFile,
  type ProgressEvent,
} from "./services/download";

export const getVideoInfo = catchAsync(async (req, res) => {
  const { url } = infoSchema.parse(req.body ?? {});
  const info = await fetchVideoInfo(url);

  res.status(statusCodes.OK).json(info);
});

const writeSseHeaders = (res: import("express").Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
};

const createSseSender = (
  res: import("express").Response,
): ((data: ProgressEvent & { jobId?: string }) => void) => {
  return (data) => {
    if (res.writableEnded || res.destroyed) return;

    res.write(`data: ${JSON.stringify(data)}\n\n`);

    if (data.phase === "ready" || data.phase === "error") {
      setTimeout(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.end();
        }
      }, 30);
    }
  };
};

export const startDownload = catchAsync(async (req, res) => {
  const { url, formatId, kind, size } = downloadSchema.parse(req.query);

  writeSseHeaders(res);

  const send = createSseSender(res);

  const jobId = await startDownloadJob(url, formatId, kind, size ?? null, (event) => send(event));

  send({
    phase: "preparing",
    stream: null,
    streamPercent: null,
    streamLoaded: null,
    streamTotal: null,
    overallPercent: null,
    overallLoaded: null,
    overallTotal: null,
    speed: null,
    eta: null,
    jobId,
  });
});

export const pauseDownload = catchAsync(async (req, res) => {
  const jobId = req.params.jobId;

  if (!jobId || typeof jobId !== "string") {
    res.status(statusCodes.BAD_REQUEST).json({
      message: "Invalid job id",
    });
    return;
  }

  const paused = pauseDownloadJob(jobId);

  if (!paused) {
    res.status(statusCodes.CONFLICT).json({
      message: "Download cannot be paused",
    });
    return;
  }

  res.status(statusCodes.OK).json({
    message: "Download paused",
  });
});

export const resumeDownload = catchAsync(async (req, res) => {
  const jobId = req.params.jobId;

  if (!jobId || typeof jobId !== "string") {
    res.status(statusCodes.BAD_REQUEST).json({
      message: "Invalid job id",
    });
    return;
  }

  const job = getJob(jobId);

  if (!job || job.status !== "paused") {
    res.status(statusCodes.CONFLICT).json({
      message: "Download cannot be resumed",
    });
    return;
  }

  writeSseHeaders(res);

  const send = createSseSender(res);

  send({
    phase: "preparing",
    stream: null,
    streamPercent: null,
    streamLoaded: null,
    streamTotal: null,
    overallPercent: null,
    overallLoaded: null,
    overallTotal: null,
    speed: null,
    eta: null,
    jobId,
  });

  const resumed = resumeDownloadJob(jobId, (event) => send(event));

  if (!resumed) {
    res.end();
  }
});

export const downloadJobFile = catchAsync(async (req, res, next) => {
  const raw = req.params.jobId;
  const jobId = Array.isArray(raw) ? raw[0] : raw;

  if (!jobId || typeof jobId !== "string") {
    res.status(statusCodes.BAD_REQUEST).json({
      message: "Invalid job id",
    });
    return;
  }

  const prepared = takeJobFile(jobId);

  if (!prepared) {
    const job = getJob(jobId);

    if (!job) {
      res.status(statusCodes.NOT_FOUND).json({
        message: "Job not found or expired",
      });
      return;
    }

    if (job.status === "running" || job.status === "paused") {
      res.status(statusCodes.ACCEPTED).json({
        message: "Still preparing",
      });
      return;
    }

    res.status(statusCodes.UNPROCESSABLE_ENTITY).json({
      message: job.error ?? "Download failed",
    });
    return;
  }

  const { filePath, fileName, cleanup } = prepared;

  res.setHeader("Cache-Control", "no-store");

  res.download(filePath, fileName, (error) => {
    if (error && !res.headersSent) {
      next(error);
      return;
    }

    if (!error) {
      void cleanup();
    }
  });
});
