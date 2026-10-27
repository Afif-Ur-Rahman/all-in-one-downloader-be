import { buildDefaultDownloadFlags, fetchRawInfo, toVideoInfo } from "../shared";

import { buildYouTubeAuthFlags } from "./youtube-auth";

import type { PlatformService } from "../types";

export const youtubeService: PlatformService = {
  id: "youtube",

  getInfo: async (url) => toVideoInfo(await fetchRawInfo(url, buildYouTubeAuthFlags()), "YouTube"),

  getDownloadFlags: (context) => ({
    ...buildYouTubeAuthFlags(),
    ...buildDefaultDownloadFlags(context),
  }),
};
