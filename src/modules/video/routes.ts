import { Router } from "express";

import { downloadLimiter, downloadSlot } from "@/middlewares";

import { downloadJobFile, getVideoInfo, startDownload } from "./controllers";

const router = Router();

router.post("/info", getVideoInfo);

router.get("/download/start", downloadLimiter, downloadSlot, startDownload);
router.get("/download/:jobId", downloadLimiter, downloadJobFile);

export { router as videoRoutes };
