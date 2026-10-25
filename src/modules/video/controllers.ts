import { statusCodes } from "@/constants/statusCodes";
import { catchAsync } from "@/utils";

import { downloadSchema, infoSchema } from "./schema";
import { fetchVideoInfo, prepareDownload } from "./services";

export const getVideoInfo = catchAsync(async (req, res) => {
  const { url } = infoSchema.parse(req.body ?? {});
  const info = await fetchVideoInfo(url);

  res.status(statusCodes.OK).json(info);
});

export const downloadVideo = catchAsync(async (req, res, next) => {
  const { url, formatId, kind } = downloadSchema.parse(req.query);
  const { filePath, fileName, cleanup } = await prepareDownload(url, formatId, kind);

  if (res.destroyed) {
    await cleanup();
    return;
  }

  res.on("close", () => {
    void cleanup();
  });

  res.setHeader("Cache-Control", "no-store");

  res.download(filePath, fileName, (error) => {
    if (error && !res.headersSent) next(error);
  });
});
