import { YOUTUBE_COOKIES_FILE, YOUTUBE_PROXY } from "@/constants/env";

import { buildDefaultDownloadFlags, fetchVideoInfo, toVideoInfo } from "../shared";
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

console.log("[YouTube] Cookie flags prepared:", Object.keys(cookieFlags));

export const youtubeService: PlatformService = {
  id: "youtube",

  getInfo: async (url) =>
    toVideoInfo(
      await fetchVideoInfo(url, {
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
