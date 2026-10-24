import { Redis } from "ioredis";

import { REDIS_URL } from "@/constants/env";

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  if (!REDIS_URL) return null;
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: () => null, // don't auto-reconnect; caller handles availability
    });
    redisClient.on("error", (err) => console.error("Redis error:", err));
  }
  return redisClient;
};
