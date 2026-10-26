import { readdir, stat } from "fs/promises";
import path from "path";

export type OutputFile = {
  filePath: string;
  fileName: string;
  size: number;
};

export const findOutputFile = async (directory: string): Promise<OutputFile> => {
  const files = await readdir(directory);
  const fileName = files.find((file) => !/\.(?:part|ytdl|temp)$/i.test(file));

  if (!fileName) {
    throw new Error("No output file was produced");
  }

  const filePath = path.join(directory, fileName);
  const info = await stat(filePath);

  if (!info.isFile() || info.size === 0) {
    throw new Error("Empty file");
  }

  return { filePath, fileName, size: info.size };
};
