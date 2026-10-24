import compression from "compression";
import cors from "cors";
import express, { Application } from "express";
import helmet from "helmet";

import { errorHandler, notFoundHandler } from "./middlewares";
import { routes } from "./routes";

const app: Application = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"],
  optionsSuccessStatus: 200,
};

// Trust proxy (required when behind a reverse proxy like Nginx)
app.set("trust proxy", 1);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));

// Routes
app.use("/", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
