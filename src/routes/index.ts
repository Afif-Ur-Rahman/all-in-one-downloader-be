import { Router } from "express";

import { rateLimiter } from "@/middlewares";
import { videoRoutes } from "@/modules";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Welcome to AIO Downloader API" });
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/api", rateLimiter);
router.use("/api/video", videoRoutes);

export { router as routes };
