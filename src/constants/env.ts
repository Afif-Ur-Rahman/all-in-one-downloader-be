import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT;
export const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
export const MODE = process.env.MODE || "";

// YouTube
export const YOUTUBE_COOKIES_FILE = process.env.YOUTUBE_COOKIES_FILE || "";
export const YOUTUBE_PROXY = process.env.YOUTUBE_PROXY || "";

// Facebook
export const FACEBOOK_COOKIES_FILE = process.env.FACEBOOK_COOKIES_FILE || "";
export const FACEBOOK_PROXY = process.env.FACEBOOK_PROXY || "";

// Future platforms
export const TIKTOK_COOKIES_FILE = process.env.TIKTOK_COOKIES_FILE || "";
export const TIKTOK_PROXY = process.env.TIKTOK_PROXY || "";

export const INSTAGRAM_COOKIES_FILE = process.env.INSTAGRAM_COOKIES_FILE || "";
export const INSTAGRAM_PROXY = process.env.INSTAGRAM_PROXY || "";
