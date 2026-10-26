import type { DownloadFlagsContext } from "../types";

export const buildDefaultDownloadFlags = ({
  formatId,
  kind,
}: DownloadFlagsContext): Record<string, unknown> => {
  if (kind === "audio") {
    return formatId === "mp3"
      ? {
          format: "bestaudio/best",
          extractAudio: true,
          audioFormat: "mp3",
          audioQuality: "192K",
        }
      : { format: formatId };
  }

  return {
    format: `${formatId}+bestaudio/${formatId}`,
    mergeOutputFormat: "mp4",
  };
};
