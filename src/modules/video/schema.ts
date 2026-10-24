import { z } from "zod";

import { detectPlatform } from "@/constants/platforms";

export const infoSchema = z.object({
  url: z
    .string({ error: "A link is required" })
    .trim()
    .max(2048, "That link is too long")
    .refine(
      (value) => detectPlatform(value) !== null,
      "This link is not from a supported platform",
    ),
});
