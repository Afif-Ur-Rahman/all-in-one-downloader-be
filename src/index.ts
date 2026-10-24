import { PORT, JWT_SECRET } from "@/constants/env";
import { LOGUI } from "@/constants/logs";

import { server } from "./server";

// Validate required environment variables before starting
const requiredEnvVars = { JWT_SECRET };
const missingVars = Object.entries(requiredEnvVars)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(", ")}`);
  process.exit(1);
}

// Server setup
const port: number = parseInt(PORT as string, 10) || 4000;
server.listen(port, () => {
  console.error(LOGUI.FgYellow, `Serving on port ${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(LOGUI.FgRed, error);
});
