import { statusCodes } from "@/constants/statusCodes";
import { catchAsync } from "@/utils";

import { infoSchema } from "./schema";
import { fetchVideoInfo } from "./services";

export const getVideoInfo = catchAsync(async (req, res) => {
  const { url } = infoSchema.parse(req.body ?? {});
  const info = await fetchVideoInfo(url);

  res.status(statusCodes.OK).json(info);
});
