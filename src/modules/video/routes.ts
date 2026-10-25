import { Router } from "express";

import { downloadLimiter, downloadSlot } from "@/middlewares";

import { downloadVideo, getVideoInfo } from "./controllers";

const router = Router();

router.post("/info", getVideoInfo);
router.get("/download", downloadLimiter, downloadSlot, downloadVideo);

export { router as videoRoutes };
