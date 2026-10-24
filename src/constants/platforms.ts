export type Platform = {
  id: string;
  name: string;
  domains: string[];
};

export const supportedPlatforms: Platform[] = [
  { id: "youtube", name: "YouTube", domains: ["youtube.com", "youtu.be"] },
  { id: "tiktok", name: "TikTok", domains: ["tiktok.com"] },
  { id: "instagram", name: "Instagram", domains: ["instagram.com"] },
  { id: "facebook", name: "Facebook", domains: ["facebook.com", "fb.watch", "fb.com"] },
  { id: "x", name: "X (Twitter)", domains: ["x.com", "twitter.com"] },
  { id: "vimeo", name: "Vimeo", domains: ["vimeo.com"] },
  { id: "reddit", name: "Reddit", domains: ["reddit.com", "redd.it"] },
];

export const detectPlatform = (input: string): Platform | null => {
  try {
    const { hostname, protocol } = new URL(input.trim());

    if (protocol !== "http:" && protocol !== "https:") return null;

    const host = hostname.toLowerCase();

    return (
      supportedPlatforms.find((platform) =>
        platform.domains.some((domain) => host === domain || host.endsWith(`.${domain}`)),
      ) ?? null
    );
  } catch {
    return null;
  }
};
