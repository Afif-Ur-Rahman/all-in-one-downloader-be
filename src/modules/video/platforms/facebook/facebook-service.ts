import { buildDefaultDownloadFlags, fetchRawInfo, toVideoInfo } from "../shared";

import type { PlatformService } from "../types";

// Facebook's "sd" and "hd" formats already contain audio.
// Merging bestaudio into them would add a duplicate audio track,
// so they are downloaded as they are.
const PROGRESSIVE_FORMAT_IDS = new Set(["sd", "hd"]);

export const facebookService: PlatformService = {
  id: "facebook",

  getInfo: async (url) => toVideoInfo(await fetchRawInfo(url), "Facebook"),

  getDownloadFlags: (context) => {
    if (context.kind === "video" && PROGRESSIVE_FORMAT_IDS.has(context.formatId)) {
      return { format: context.formatId, mergeOutputFormat: "mp4" };
    }

    return buildDefaultDownloadFlags(context);
  },
};
