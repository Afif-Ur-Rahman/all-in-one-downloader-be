import { statusCodes } from "@/constants/statusCodes";
import { catchAsync } from "@/utils";

import { downloadSchema, infoSchema } from "./schema";
import { fetchVideoInfo } from "./services";
import { startDownloadJob, getJob, takeJobFile, type ProgressEvent } from "./services/download";

export const getVideoInfo = catchAsync(async (req, res) => {
  const { url } = infoSchema.parse(req.body ?? {});
  const info = await fetchVideoInfo(url);

  res.status(statusCodes.OK).json(info);
});

export const startDownload = catchAsync(async (req, res) => {
  const { url, formatId, kind } = downloadSchema.parse(req.query);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let terminalEventSent = false;

  const send = (data: ProgressEvent & { jobId?: string }) => {
    if (res.writableEnded || res.destroyed) return;

    res.write(`data: ${JSON.stringify(data)}\n\n`);

    if (data.phase === "ready" || data.phase === "error") {
      terminalEventSent = true;

      setTimeout(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.end();
        }
      }, 30);
    }
  };

  const jobId = await startDownloadJob(url, formatId, kind, (event) => send(event));

  // Send the job ID before progress events so the frontend can
  // reliably locate the prepared file after the stream ends.
  if (!res.writableEnded && !res.destroyed) {
    res.write(
      `data: ${JSON.stringify({
        phase: "preparing",
        stream: null,
        streamPercent: null,
        streamLoaded: null,
        streamTotal: null,
        speed: null,
        eta: null,
        jobId,
      })}\n\n`,
    );
  }

  // Normally the download completes asynchronously. If a terminal
  // event arrived first, the stream has already been scheduled to close.
  void terminalEventSent;
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

    if (job.status === "running") {
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

  if (res.destroyed) {
    await cleanup();
    return;
  }

  let cleaned = false;

  const cleanOnce = async () => {
    if (cleaned) return;
    cleaned = true;
    await cleanup();
  };

  res.on("close", () => {
    void cleanOnce();
  });

  res.setHeader("Cache-Control", "no-store");

  res.download(filePath, fileName, (error) => {
    if (error && !res.headersSent) {
      next(error);
    }

    void cleanOnce();
  });
});
