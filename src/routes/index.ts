import { Router } from "express";

import { rateLimiter } from "@/middlewares/security-middleware";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Welcome to AIO Downloader API" });
});

router.use("/api/auth", rateLimiter);

export { router as routes };
