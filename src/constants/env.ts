import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT;
export const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
export const MODE = process.env.MODE || "";
export const SSL_KEY = process.env.SSL_KEY || "";
export const SSL_CRT = process.env.SSL_CRT || "";
export const JWT_SECRET = process.env.JWT_SECRET || "";

// Redis Configuration (optional — enables distributed rate limiting and socket scaling)
export const REDIS_URL = process.env.REDIS_URL || "";
