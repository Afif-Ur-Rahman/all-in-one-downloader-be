import fs from "fs";

type PlatformAuthConfig = {
  platformName: string;
  cookieFile?: string;
  proxy?: string;
};

type PlatformCookieState = {
  activated: boolean;
  disabled: boolean;
};

const cookieStates = new Map<string, PlatformCookieState>();

const getState = (platformName: string): PlatformCookieState => {
  const key = platformName.toLowerCase();

  if (!cookieStates.has(key)) {
    cookieStates.set(key, {
      activated: false,
      disabled: false,
    });
  }

  return cookieStates.get(key) as PlatformCookieState;
};

export const areCookiesActivated = (platformName: string): boolean =>
  getState(platformName).activated;

export const areCookiesDisabled = (platformName: string): boolean =>
  getState(platformName).disabled;

export const activatePlatformCookies = (platformName: string): void => {
  const state = getState(platformName);

  if (state.disabled) return;

  state.activated = true;

  console.info(`[${platformName}] Cookies activated after auth error.`);
};

export const disablePlatformCookies = (platformName: string, reason: string): void => {
  const state = getState(platformName);

  state.activated = false;
  state.disabled = true;

  console.error(`[${platformName}] Cookies disabled automatically. Reason: ${reason}`);
};

const readCookieFile = (platformName: string, cookieFile: string): string | null => {
  try {
    if (!fs.existsSync(cookieFile)) {
      console.warn(`[${platformName}] Cookie file not found: ${cookieFile}`);

      return null;
    }

    const contents = fs.readFileSync(cookieFile, "utf8");

    if (!contents.trim()) {
      console.warn(`[${platformName}] Cookie file is empty: ${cookieFile}`);

      return null;
    }

    return cookieFile;
  } catch (error) {
    console.error(`[${platformName}] Failed to read cookie file:`, error);

    return null;
  }
};

const validateProxy = (platformName: string, proxy?: string): string | null => {
  if (!proxy) return null;

  const value = proxy.trim();

  if (!value) return null;

  const isValid =
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("socks4://") ||
    value.startsWith("socks5://");

  if (!isValid) {
    console.warn(`[${platformName}] Invalid proxy format: ${value}`);

    return null;
  }

  return value;
};

export const buildPlatformBaseFlags = ({
  platformName,
  proxy,
}: {
  platformName: string;
  proxy?: string;
}): Record<string, unknown> => {
  const flags: Record<string, unknown> = {};

  const resolvedProxy = validateProxy(platformName, proxy);

  if (resolvedProxy) {
    flags.proxy = resolvedProxy;
  }

  return flags;
};

export const buildPlatformCookieFlags = ({
  platformName,
  cookieFile,
  proxy,
}: PlatformAuthConfig): Record<string, unknown> => {
  const state = getState(platformName);
  const flags = buildPlatformBaseFlags({ platformName, proxy });

  if (!cookieFile || state.disabled || !state.activated) {
    return flags;
  }

  const resolvedCookieFile = readCookieFile(platformName, cookieFile);

  if (resolvedCookieFile) {
    flags.cookies = resolvedCookieFile;
  }

  return flags;
};
