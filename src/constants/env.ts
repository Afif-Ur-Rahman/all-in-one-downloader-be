import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT;
export const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
export const MODE = process.env.MODE || "";
