import { detectPlatform } from "@/constants/platforms";
import { statusCodes } from "@/constants/statusCodes";
import { AppError } from "@/utils/app-error";

import { facebookService } from "./facebook";
import { youtubeService } from "./youtube";

import type { PlatformService } from "./types";

const services: Record<string, PlatformService> = {
  [youtubeService.id]: youtubeService,
  [facebookService.id]: facebookService,
};

export const resolvePlatformService = (url: string): PlatformService => {
  const platform = detectPlatform(url);

  if (!platform) {
    throw new AppError("This link is not from a supported platform", statusCodes.BAD_REQUEST);
  }

  const service = services[platform.id];

  if (!service) {
    throw new AppError(
      `${platform.name} downloads are not available yet`,
      statusCodes.NOT_IMPLEMENTED,
    );
  }

  return service;
};
