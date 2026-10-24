import { createServer as createHttpServer } from "http";

import { MODE } from "@/constants/env";
import { LOGUI } from "@/constants/logs";

import app from "./app";

const createServer = () => {
  console.log(LOGUI.FgGreen, `Creating server... ${MODE} mode`);
  return createHttpServer(app);
};

const server = createServer();

export { server };
