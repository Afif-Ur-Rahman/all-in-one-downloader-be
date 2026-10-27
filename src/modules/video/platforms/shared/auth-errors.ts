const AUTH_ERROR_PATTERNS = [
  /login/i,
  /log in/i,
  /sign in/i,
  /signin/i,
  /checkpoint/i,
  /account.*locked/i,
  /account.*disabled/i,
  /session expired/i,
  /cookies.*no longer valid/i,
  /confirm your identity/i,
  /security check/i,
  /not logged in/i,
  /confirm you.?re not a bot/i,
];

export const isAuthError = (message: string): boolean =>
  AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
