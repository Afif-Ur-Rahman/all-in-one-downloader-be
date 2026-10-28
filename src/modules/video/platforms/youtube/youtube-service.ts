import { YOUTUBE_COOKIES_FILE, YOUTUBE_PROXY } from "@/constants/env";

import { buildDefaultDownloadFlags, fetchVideoInfo, toVideoInfo } from "../shared";
import {
  areCookiesActivated,
  buildPlatformBaseFlags,
  buildPlatformCookieFlags,
} from "../shared/platform-auth";

import type { PlatformService } from "../types";

const platformName = "YouTube";

const ytFlags = {
  jsRuntimes: "node",
  remoteComponents: "ejs:github",
};

const baseFlags = {
  ...buildPlatformBaseFlags({
    platformName,
    proxy: YOUTUBE_PROXY || undefined,
  }),
  ...ytFlags,
};

const cookieFlags = {
  ...buildPlatformCookieFlags({
    platformName,
    cookieFile: YOUTUBE_COOKIES_FILE || undefined,
    proxy: YOUTUBE_PROXY || undefined,
  }),
  ...ytFlags,
};

export const youtubeService: PlatformService = {
  id: "youtube",

  getInfo: async (url) =>
    toVideoInfo(
      await fetchVideoInfo(url, {
        platformName,
        baseFlags,
        cookieFlags,
        cookiesFirst: true,
      }),
      platformName,
    ),

  getDownloadFlags: (context) => ({
    ...(areCookiesActivated(platformName) ? cookieFlags : baseFlags),
    ...buildDefaultDownloadFlags(context),
  }),
};
