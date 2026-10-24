export const AUTH_CONFIG = {
  JWT_EXPIRES_IN: "24h",
  PASSWORD_MIN_LENGTH: 8,
  OTP_EXPIRES_IN: 300, // 5 minutes in seconds
  OTP_LENGTH: 6,
};

export const EMAIL_CONFIG = {
  TEMPLATES: {
    RESET_PASSWORD: "reset-password",
    WELCOME: "welcome",
  },
};
