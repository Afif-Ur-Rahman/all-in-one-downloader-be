import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const logYtDlpVersion = async (): Promise<void> => {
  const binaryPath = process.env.YOUTUBE_DL_PATH;

  if (!binaryPath) {
    console.warn("[yt-dlp] YOUTUBE_DL_PATH is not set.");
    return;
  }

  try {
    const { stdout } = await execFileAsync(binaryPath, ["--version"]);
    console.log(`[yt-dlp] Using binary: ${binaryPath}`);
    console.log(`[yt-dlp] Version: ${stdout.trim()}`);
  } catch (error) {
    console.error("[yt-dlp] Failed to execute configured binary:", error);
  }
};
