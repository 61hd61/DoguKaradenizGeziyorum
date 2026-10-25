// API Configuration
import "dotenv/config";

export const config = {
  // Server
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  apiPrefix: "/api/v1",

  // Database
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:1234@localhost:5432/trabzon_turizm?schema=public",

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production-min-32-chars",
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "30d",
    issuer: "turizm-platformu",
    audience: "turizm-platformu-users",
  },

  // Password Hashing (bcrypt)
  bcrypt: {
    saltRounds: 12,
  },

  // Email (Nodemailer)
  email: {
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "1025", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "noreply@turizm.local",
    verifyUrl: process.env.EMAIL_VERIFY_URL || "http://localhost:3000/verify-email",
    resetUrl: process.env.EMAIL_RESET_URL || "http://localhost:3000/reset-password",
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  },

  // Rate Limiting
  rateLimit: {
    auth: { max: 5, windowMs: 60_000 },
    api: { max: 100, windowMs: 60_000 },
    upload: { max: 10, windowMs: 60_000 },
  },

  // File Upload
  upload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    destination: "./uploads",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },

  // External APIs
  weather: {
    apiUrl: "https://api.open-meteo.com/v1/forecast",
    cacheTtl: 6 * 60 * 60 * 1000, // 6 hours
  },

  translation: {
    apiUrl: process.env.LIBRETRANSLATE_URL || "https://libretranslate.de",
    cacheTtl: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Swagger
  swagger: {
    enabled: process.env.NODE_ENV !== "production",
    path: "/docs",
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",
};

export type Config = typeof config;