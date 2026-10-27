import { YOUTUBE_COOKIES_FILE, YOUTUBE_PROXY } from "@/constants/env";

import { buildDefaultDownloadFlags, fetchRawInfoWithCookieFallback, toVideoInfo } from "../shared";
import {
  areCookiesActivated,
  buildPlatformBaseFlags,
  buildPlatformCookieFlags,
} from "../shared/platform-auth";

import type { PlatformService } from "../types";

const platformName = "YouTube";

const baseFlags = buildPlatformBaseFlags({
  platformName,
  proxy: YOUTUBE_PROXY || undefined,
});

const cookieFlags = buildPlatformCookieFlags({
  platformName,
  cookieFile: YOUTUBE_COOKIES_FILE || undefined,
  proxy: YOUTUBE_PROXY || undefined,
});

export const youtubeService: PlatformService = {
  id: "youtube",

  getInfo: async (url) =>
    toVideoInfo(
      await fetchRawInfoWithCookieFallback(url, {
        platformName,
        baseFlags,
        cookieFlags,
      }),
      platformName,
    ),

  getDownloadFlags: (context) => ({
    ...(areCookiesActivated(platformName) ? cookieFlags : baseFlags),
    ...buildDefaultDownloadFlags(context),
  }),
};
