export const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_FILE_SIZE = "500M";
export const JOB_TTL_MS = 30 * 60 * 1000;
export const CLEANUP_INTERVAL_MS = 60_000;

export const PROGRESS_PREFIX = "AIOP";

export const PROGRESS_TEMPLATE = [
  `download:${PROGRESS_PREFIX}`,
  "%(info.format_id)s",
  "%(progress.status)s",
  "%(progress.downloaded_bytes)s",
  "%(progress.total_bytes)s",
  "%(progress.total_bytes_estimate)s",
  "%(progress.fragment_index)s",
  "%(progress.fragment_count)s",
  "%(progress.speed)s",
  "%(progress.eta)s",
].join("|");
