import { statusCodes, TIKTOK_COOKIES_FILE, TIKTOK_PROXY } from "@/constants";
import { AppError } from "@/utils";

import { buildDefaultDownloadFlags, fetchVideoInfo, toVideoInfo } from "../shared";
import {
  areCookiesActivated,
  buildPlatformBaseFlags,
  buildPlatformCookieFlags,
} from "../shared/platform-auth";

import type { PlatformService } from "../types";

const platformName = "TikTok";

// yt-dlp exposes the watermarked copy as the "download" format. We never offer it.
const WATERMARKED_FORMAT_IDS = new Set(["download"]);

const baseFlags = buildPlatformBaseFlags({
  platformName,
  proxy: TIKTOK_PROXY || undefined,
});

const cookieFlags = buildPlatformCookieFlags({
  platformName,
  cookieFile: TIKTOK_COOKIES_FILE || undefined,
  proxy: TIKTOK_PROXY || undefined,
});

export const tiktokService: PlatformService = {
  id: "tiktok",

  getInfo: async (url) => {
    const raw = await fetchVideoInfo(url, {
      platformName,
      baseFlags,
      cookieFlags,
      cookiesFirst: true,
    });

    const allFormats = raw.formats ?? [];
    const cleanFormats = allFormats.filter(
      (format) => !WATERMARKED_FORMAT_IDS.has(format.format_id),
    );

    const info = toVideoInfo(
      { ...raw, formats: cleanFormats.length > 0 ? cleanFormats : allFormats },
      platformName,
    );

    if (!info.formats.some((format) => format.kind === "video")) {
      throw new AppError(
        "This TikTok post doesn't contain a downloadable video.",
        statusCodes.UNPROCESSABLE_ENTITY,
      );
    }

    return info;
  },

  getDownloadFlags: (context) => {
    const authFlags = areCookiesActivated(platformName) ? cookieFlags : baseFlags;

    // TikTok formats already include audio, so there is nothing to merge in.
    if (context.kind === "video") {
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
