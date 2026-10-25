import { Router } from "express";

import { downloadLimiter, downloadSlot } from "@/middlewares";

import {
  downloadJobFile,
  getVideoInfo,
  pauseDownload,
  resumeDownload,
  startDownload,
} from "./controllers";

const router = Router();

router.post("/info", getVideoInfo);

router.get("/download/start", downloadLimiter, downloadSlot, startDownload);

router.post("/download/:jobId/pause", downloadLimiter, pauseDownload);
router.get("/download/:jobId/resume", downloadLimiter, resumeDownload);

router.get("/download/:jobId", downloadLimiter, downloadJobFile);

export { router as videoRoutes };
