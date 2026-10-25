import crypto from "node:crypto";
import { Pool } from "pg";

const usersDbUrl =
  process.env.USER_DATABASE_URL ||
  "postgresql://postgres:1234@localhost:5432/trabzon_turizm_users";

export const userPool = new Pool({ connectionString: usersDbUrl });

export async function ensureUsersDatabaseSchema() {
  await userPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      "passwordHash" VARCHAR(255) NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
      "emailVerifiedAt" TIMESTAMPTZ,
      "lastLoginAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await userPool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      "userId" TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "firstName" VARCHAR(80),
      "lastName" VARCHAR(80),
      bio TEXT,
      "encryptedData" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await userPool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      revoked BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await userPool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await userPool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

const encKey = () => {
  const raw = process.env.PII_ENCRYPTION_KEY || "turizm-dev-pii-key-32bytes!!";
  return crypto.createHash("sha256").update(raw).digest();
};

export function encryptPii(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptPii(payload: string): string {
  if (!payload) return "";
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
