import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { statusCodes } from "@/constants/statusCodes";
import { AppError } from "@/utils/app-error";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(statusCodes.NOT_FOUND).json({ message: "Route not found" });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res
      .status(statusCodes.BAD_REQUEST)
      .json({ message: err.issues[0]?.message ?? "Invalid request" });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if ((err as { type?: string })?.type === "entity.parse.failed") {
    res.status(statusCodes.BAD_REQUEST).json({ message: "Invalid JSON body" });
    return;
  }

  if (err instanceof Error && err.message === "Not allowed by CORS") {
    res.status(statusCodes.FORBIDDEN).json({ message: "Origin not allowed" });
    return;
  }

  console.error(err);
  res.status(statusCodes.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong" });
};
