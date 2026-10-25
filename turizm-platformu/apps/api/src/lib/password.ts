import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);

/** Argon2 yerine saf Node scrypt (Windows ARM64 native derleme sorunu yok). Eski bcrypt hash'leri okunur. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("scrypt$")) {
    const [, saltHex, hashHex] = stored.split("$");
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    return crypto.timingSafeEqual(expected, derived);
  }
  if (stored.startsWith("$2")) {
    return bcrypt.compare(password, stored);
  }
  return false;
}
