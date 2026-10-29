const AUTH_ERROR_PATTERNS = [
  /sign in to confirm you.?re not a bot/i,
  /confirm you.?re not a bot/i,
  /please sign in/i,
  /login required/i,
  /log in required/i,
  /not logged in/i,
  /cookies are no longer valid/i,
  /cookie.*no longer valid/i,
  /account has been disabled/i,
  /account is disabled/i,
  /security checkpoint/i,
  /checkpoint required/i,
  /confirm your identity/i,
  /empty media response/i,
  /rate-limit reached/i,
];

export const isAuthError = (message: string): boolean =>
  AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
