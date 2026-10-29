import { INSTAGRAM_COOKIES_FILE, INSTAGRAM_PROXY } from "@/constants/env";
import { statusCodes } from "@/constants/statusCodes";
import { AppError } from "@/utils/app-error";

import { buildDefaultDownloadFlags, fetchVideoInfo, toVideoInfo } from "../shared";
import {
  areCookiesActivated,
  buildPlatformBaseFlags,
  buildPlatformCookieFlags,
} from "../shared/platform-auth";

import { resolveDuration } from "./duration";

import type { PlatformService } from "../types";

const platformName = "Instagram";

const baseFlags = buildPlatformBaseFlags({
  platformName,
  proxy: INSTAGRAM_PROXY || undefined,
});

const cookieFlags = buildPlatformCookieFlags({
  platformName,
  cookieFile: INSTAGRAM_COOKIES_FILE || undefined,
  proxy: INSTAGRAM_PROXY || undefined,
});

export const instagramService: PlatformService = {
  id: "instagram",

  getInfo: async (url) => {
    const raw = await fetchVideoInfo(url, {
      platformName,
      baseFlags,
      cookieFlags,
      cookiesFirst: true,
    });

    const info = toVideoInfo(
      { ...raw, duration: await resolveDuration(raw.duration, raw.formats) },
      platformName,
    );

    if (!info.formats.some((format) => format.kind === "video")) {
      throw new AppError(
        "This Instagram post doesn't contain a downloadable video.",
        statusCodes.UNPROCESSABLE_ENTITY,
      );
    }

    return info;
  },

  getDownloadFlags: (context) => ({
    ...(areCookiesActivated(platformName) ? cookieFlags : baseFlags),
    ...buildDefaultDownloadFlags(context),
  }),
};
