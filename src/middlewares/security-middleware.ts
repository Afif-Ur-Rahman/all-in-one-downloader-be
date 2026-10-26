import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { statusCodes } from "@/constants/statusCodes";

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ message: "Too many requests. Please try again later." });
  },
});

export const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ message: "Too many downloads. Please try again in a few minutes." });
  },
});

const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;

export const downloadSlot = (_req: Request, res: Response, next: NextFunction) => {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    res
      .status(statusCodes.SERVICE_UNAVAILABLE)
      .json({ message: "The server is busy. Please try again in a moment." });
    return;
  }

  activeDownloads += 1;

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeDownloads -= 1;
  };

  res.on("close", release);

  next();
};
