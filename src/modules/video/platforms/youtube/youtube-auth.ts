import fs from "fs";

import { YOUTUBE_COOKIES_FILE } from "@/constants/env";

let cachedCookieFile: string | null = null;

const getYouTubeCookieFile = (): string | null => {
  if (!YOUTUBE_COOKIES_FILE) return null;

  if (cachedCookieFile !== null) return cachedCookieFile;

  try {
    if (!fs.existsSync(YOUTUBE_COOKIES_FILE)) {
      console.warn(`[YouTube] Cookie file not found at: ${YOUTUBE_COOKIES_FILE}`);

      cachedCookieFile = null;
      return null;
    }

    const contents = fs.readFileSync(YOUTUBE_COOKIES_FILE, "utf8");

    if (!contents.includes("youtube.com")) {
      console.warn("[YouTube] Cookie file does not appear to contain YouTube cookies.");

      cachedCookieFile = null;
      return null;
    }

    cachedCookieFile = YOUTUBE_COOKIES_FILE;
    return cachedCookieFile;
  } catch (error) {
    console.error("[YouTube] Failed to read cookie file:", error);
    cachedCookieFile = null;
    return null;
  }
};

export const buildYouTubeAuthFlags = (): Record<string, unknown> => {
  const cookieFile = getYouTubeCookieFile();

  if (!cookieFile) return {};

  return {
    cookies: cookieFile,
  };
};
