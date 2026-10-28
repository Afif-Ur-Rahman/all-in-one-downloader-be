import { CLEANUP_INTERVAL_MS, JOB_TTL_MS } from "./constants";

import type { Job } from "./types";

export const jobs = new Map<string, Job>();

export const getJob = (id: string) => jobs.get(id);

setInterval(() => {
  const now = Date.now();

  for (const [id, job] of jobs) {
    if (job.status === "running") continue;

    if (now - job.createdAt > JOB_TTL_MS) {
      void job.cleanup();
      jobs.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();
