import { z } from "zod";

import { detectPlatform } from "@/constants/platforms";

const urlField = z
  .string({ error: "A link is required" })
  .trim()
  .max(2048, "That link is too long")
  .refine((value) => detectPlatform(value) !== null, "This link is not from a supported platform");

export const infoSchema = z.object({
  url: urlField,
});

export const downloadSchema = z.object({
  url: urlField,
  formatId: z
    .string({ error: "A format is required" })
    .trim()
    .max(64, "That format is invalid")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "That format is invalid"),
  kind: z.enum(["video", "audio"], { error: "Kind must be video or audio" }),
  size: z.coerce
    .number()
    .int()
    .positive()
    .max(2 * 1024 ** 3)
    .optional()
    .catch(undefined),
});
