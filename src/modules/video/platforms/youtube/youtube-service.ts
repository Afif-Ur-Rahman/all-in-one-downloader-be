import { buildDefaultDownloadFlags, fetchRawInfo, toVideoInfo } from "../shared";

import type { PlatformService } from "../types";

export const youtubeService: PlatformService = {
  id: "youtube",

  getInfo: async (url) => toVideoInfo(await fetchRawInfo(url), "YouTube"),

  getDownloadFlags: (context) => buildDefaultDownloadFlags(context),
};
