import { resolvePlatformService } from "../platforms";
import { VideoInfo } from "../platforms/shared";

export const fetchVideoInfo = async (url: string): Promise<VideoInfo> => {
  const service = resolvePlatformService(url);

  return service.getInfo(url);
};
