import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { PORT } from "@/constants/env";
import { LOGUI } from "@/constants/logs";

import { server } from "./server";

const execFileAsync = promisify(execFile);

const port: number = parseInt(PORT as string, 10) || 4000;

const logYtDlpVersion = async (): Promise<void> => {
  const binaryPath = process.env.YOUTUBE_DL_PATH;

  if (!binaryPath) {
    console.warn(LOGUI.FgYellow, "[yt-dlp] YOUTUBE_DL_PATH is not set.");
    return;
  }

  try {
    const { stdout } = await execFileAsync(binaryPath, ["--version"]);

    console.log(LOGUI.FgYellow, `[yt-dlp] Using binary: ${binaryPath}`);
    console.log(LOGUI.FgYellow, `[yt-dlp] Version: ${stdout.trim()}`);
  } catch (error) {
    console.error(LOGUI.FgRed, "[yt-dlp] Failed to execute configured binary:", error);
  }
};

const start = async (): Promise<void> => {
  await logYtDlpVersion();

  server.listen(port, () => {
    console.log(LOGUI.FgYellow, `Serving on port ${port}`);
  });
};

start().catch((error) => {
  console.error(LOGUI.FgRed, "Failed to start server:", error);
  process.exit(1);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(LOGUI.FgRed, error);
});
