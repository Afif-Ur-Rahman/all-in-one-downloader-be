import { resolvePlatformService } from "../platforms";

import type { VideoInfo } from "../types";

export const fetchVideoInfo = async (url: string): Promise<VideoInfo> => {
  const service = resolvePlatformService(url);

  return service.getInfo(url);
};
