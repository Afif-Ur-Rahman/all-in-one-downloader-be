import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { validationResult } from "express-validator";
import helmet from "helmet";
import { RedisStore } from "rate-limit-redis";

import { getRedisClient } from "@/config/redis";
import { statusCodes } from "@/constants/statusCodes";

const BLOCK_KEY_PREFIX = "blocked_ip:";
const BLOCK_DURATION_SECONDS = 60 * 60; // 1 hour

const getClientIp = (req: Request): string =>
  (req.ip ?? req.socket?.remoteAddress ?? "unknown").replace(/^::ffff:/, "");

const isRedisReady = (): boolean => {
  const redis = getRedisClient();
  return !!redis && redis.status === "ready";
};

// Block an IP in Redis for BLOCK_DURATION_SECONDS
const blockIp = async (ip: string): Promise<void> => {
  if (!isRedisReady()) return;
  const redis = getRedisClient();
  try {
    await redis!.set(`${BLOCK_KEY_PREFIX}${ip}`, "1", "EX", BLOCK_DURATION_SECONDS);
  } catch {
    // Redis unavailable — skip IP blocking
  }
};

// Middleware: reject requests from blocked IPs
export const ipBlocker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (isRedisReady()) {
    const redis = getRedisClient();
    const ip = getClientIp(req);
    try {
      const blocked = await redis!.get(`${BLOCK_KEY_PREFIX}${ip}`);
      if (blocked) {
        res.status(statusCodes.TOO_MANY_REQUESTS ?? 429).json({
          message:
            "Your IP has been temporarily blocked due to too many requests. Try again later.",
        });
        return;
      }
    } catch {
      // Redis unavailable — skip IP block check
    }
  }
  next();
};

// Build the rate limiter — uses Redis store when available for consistent limits across instances
const buildRateLimiter = () => {
  const redis = isRedisReady() ? getRedisClient() : null;
  const store = redis
    ? new RedisStore({ sendCommand: (...args: string[]) => (redis as any).call(...args) })
    : undefined;

  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    ...(store ? { store } : {}),
    handler: async (req: Request, res: Response) => {
      const ip = getClientIp(req);
      await blockIp(ip);
      console.warn(`[rate-limit] IP blocked: ${ip}`);
      res.status(429).json({
        message: "Too many requests from this IP. You have been temporarily blocked for 1 hour.",
      });
    },
  });
};

// Rate limiting configuration
export const rateLimiter = buildRateLimiter();

// Tighter limiter for unauthenticated public endpoints prone to enumeration
export const usernameCheckRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getClientIp(req),
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ message: "Too many requests. Please slow down." });
  },
});

// XSS Protection middleware
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
};

// Content Security Policy middleware
export const cspMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;",
  );
  next();
};

// Request validation middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(statusCodes.BAD_REQUEST).json({ errors: errors.array() });
  }
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].replace(/[<>]/g, "");
      }
    });
  }
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
};

// Export all security middleware
export const securityMiddleware = [
  helmet(),
  ipBlocker,
  rateLimiter,
  xssProtection,
  cspMiddleware,
  securityHeaders,
  sanitizeInput,
];
