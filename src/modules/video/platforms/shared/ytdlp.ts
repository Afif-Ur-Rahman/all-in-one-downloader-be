import youtubeDl from "youtube-dl-exec";

import { statusCodes } from "@/constants/statusCodes";
import { AppError } from "@/utils/app-error";

import { getErrorMessage, isAuthError } from "./auth-errors";
import {
  activatePlatformCookies,
  areCookiesDisabled,
  disablePlatformCookies,
} from "./platform-auth";

import type { FetchRawInfoOptions, FetchWithCookieFallbackOptions, RawInfo } from "./types";

export const fetchRawInfo = async (
  url: string,
  flags: Record<string, unknown> = {},
  options: FetchRawInfoOptions = {},
): Promise<RawInfo> => {
  const platformName = options.platformName ?? "Platform";

  try {
    return (await youtubeDl(
      url,
      {
        dumpSingleJson: true,
        noWarnings: true,
        noPlaylist: true,
        ...flags,
      },
      { timeout: 30000 },
    )) as unknown as RawInfo;
  } catch (error) {
    if ((error as { timedOut?: boolean }).timedOut) {
      throw new AppError(
        "The platform took too long to respond. Please try again.",
        statusCodes.GATEWAY_TIMEOUT,
      );
    }

    const message = getErrorMessage(error);

    if (isAuthError(message)) {
      disablePlatformCookies(platformName, "Login, checkpoint, or account-flag response detected.");

      throw new AppError(
        `${platformName} is requiring verification. Cookie-based access was disabled automatically.`,
        statusCodes.UNPROCESSABLE_ENTITY,
      );
    }

    console.error(`[yt-dlp] failed for ${url}`, error);

    throw new AppError(
      "We couldn't fetch this video. Check that the link is correct and the video is public.",
      statusCodes.UNPROCESSABLE_ENTITY,
    );
  }
};

export const fetchRawInfoWithCookieFallback = async (
  url: string,
  { platformName, baseFlags, cookieFlags }: FetchWithCookieFallbackOptions,
): Promise<RawInfo> => {
  try {
    return await fetchRawInfo(url, baseFlags);
  } catch (firstError) {
    const firstMessage = getErrorMessage(firstError);

    if (!isAuthError(firstMessage)) {
      throw firstError;
    }

    const hasCookies = Boolean(cookieFlags.cookies);

    if (!hasCookies || areCookiesDisabled(platformName)) {
      throw firstError;
    }

    console.warn(`[${platformName}] Auth error without cookies. Retrying with cookies.`);

    try {
      const result = await fetchRawInfo(url, cookieFlags);

      activatePlatformCookies(platformName);

      return result;
    } catch (cookieError) {
      const cookieMessage = getErrorMessage(cookieError);

      if (isAuthError(cookieMessage)) {
        disablePlatformCookies(
          platformName,
          "Cookie retry also received an auth, checkpoint, or flag response.",
        );
      }

      throw cookieError;
    }
  }
};
