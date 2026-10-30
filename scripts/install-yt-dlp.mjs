import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const isWindows = process.platform === "win32";

const fileName = isWindows ? "yt-dlp.exe" : "yt-dlp";

const downloadUrl = isWindows
  ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

const dir = path.resolve("bin");
const filePath = path.join(dir, fileName);

await mkdir(dir, { recursive: true });

console.log(`Downloading yt-dlp for ${process.platform}...`);
console.log(`From: ${downloadUrl}`);

const response = await fetch(downloadUrl);

if (!response.ok) {
  throw new Error(`Failed to download yt-dlp: ${response.status} ${response.statusText}`);
}

await writeFile(filePath, Buffer.from(await response.arrayBuffer()));

if (!isWindows) {
  await chmod(filePath, 0o755);
}

console.log(`Installed yt-dlp to ${filePath}`);
