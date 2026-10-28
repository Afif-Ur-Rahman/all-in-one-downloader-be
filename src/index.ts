import fs from "fs";

import { PORT } from "@/constants/env";
import { LOGUI } from "@/constants/logs";

import { YOUTUBE_COOKIES_FILE } from "./constants/env";
import { server } from "./server";

console.log("[Startup] YOUTUBE_COOKIES_FILE:", YOUTUBE_COOKIES_FILE);

if (YOUTUBE_COOKIES_FILE) {
  console.log("[Startup] Cookie file exists:", fs.existsSync(YOUTUBE_COOKIES_FILE));
} else {
  console.log("[Startup] YOUTUBE_COOKIES_FILE is not set.");
}

const port: number = parseInt(PORT as string, 10) || 4000;

server.listen(port, () => {
  console.log(LOGUI.FgYellow, `Serving on port ${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(LOGUI.FgRed, error);
});
