import { Router } from "express";

import { getVideoInfo } from "./controllers";

const router = Router();

router.post("/info", getVideoInfo);

export { router as videoRoutes };
