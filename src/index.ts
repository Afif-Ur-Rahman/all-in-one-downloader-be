import { PORT } from "@/constants/env";
import { LOGUI } from "@/constants/logs";

import { server } from "./server";

const port: number = parseInt(PORT as string, 10) || 4000;

server.listen(port, () => {
  console.log(LOGUI.FgYellow, `Serving on port ${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(LOGUI.FgRed, error);
});
