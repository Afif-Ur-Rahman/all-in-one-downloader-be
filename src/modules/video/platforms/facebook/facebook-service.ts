import { FACEBOOK_COOKIES_FILE, FACEBOOK_PROXY } from "@/constants/env";

import { buildDefaultDownloadFlags, fetchRawInfoWithCookieFallback, toVideoInfo } from "../shared";
import {
  areCookiesActivated,
  buildPlatformBaseFlags,
  buildPlatformCookieFlags,
} from "../shared/platform-auth";

import type { PlatformService } from "../types";

const platformName = "Facebook";

// Facebook's "sd" and "hd" formats already contain audio.
const PROGRESSIVE_FORMAT_IDS = new Set(["sd", "hd"]);

const baseFlags = buildPlatformBaseFlags({
  platformName,
  proxy: FACEBOOK_PROXY || undefined,
});

const cookieFlags = buildPlatformCookieFlags({
  platformName,
  cookieFile: FACEBOOK_COOKIES_FILE || undefined,
  proxy: FACEBOOK_PROXY || undefined,
});

export const facebookService: PlatformService = {
  id: "facebook",

  getInfo: async (url) =>
    toVideoInfo(
      await fetchRawInfoWithCookieFallback(url, {
        platformName,
        baseFlags,
        cookieFlags,
      }),
      platformName,
    ),

  getDownloadFlags: (context) => {
    const authFlags = areCookiesActivated(platformName) ? cookieFlags : baseFlags;

    if (context.kind === "video" && PROGRESSIVE_FORMAT_IDS.has(context.formatId)) {
      return {
        ...authFlags,
        format: context.formatId,
        mergeOutputFormat: "mp4",
      };
    }

    return {
      ...authFlags,
      ...buildDefaultDownloadFlags(context),
    };
  },
};
