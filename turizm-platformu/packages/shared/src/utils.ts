// Shared Utilities
import { type LanguageCode } from "./schemas";

// ============================================
// STRING UTILS
// ============================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateUsername(firstName: string, lastName: string): string {
  const base = slugify(`${firstName}${lastName}`).substring(0, 20);
  const random = Math.random().toString(36).substring(2, 6);
  return `@${base}${random}`;
}

export function formatTurkishName(firstName: string, lastName: string): string {
  return `${firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()} ${lastName.toUpperCase()}`;
}

// ============================================
// DATE UTILS
// ============================================

export function formatDate(date: Date | string, lang: LanguageCode = "tr"): string {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : lang, options);
}

export function formatDateTime(date: Date | string, lang: LanguageCode = "tr"): string {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : lang, options);
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getDateRange(startDate: string, endDate: string): Date[] {
  const dates: Date[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

// ============================================
// GEO UTILS
// ============================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function getBoundingBox(center: Coordinates, radiusKm: number): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos(toRad(center.latitude)));

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLon: center.longitude - lonDelta,
    maxLon: center.longitude + lonDelta,
  };
}

export function isPointInRadius(point: Coordinates, center: Coordinates, radiusKm: number): boolean {
  return calculateDistance(point, center) <= radiusKm;
}

// ============================================
// VALIDATION UTILS
// ============================================

/** Gmail, Outlook, kurumsal ve alt alan adlı adresler (ornek@mail.co.uk) dahil. */
export function isValidEmail(email: string): boolean {
  const normalized = email.trim();
  if (normalized.length < 5 || normalized.length > 254) return false;
  const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]{2,}$/i;
  return emailRegex.test(normalized);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^@[a-zA-Z0-9_]{2,49}$/.test(username);
}

export function isStrongPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push("En az 8 karakter");
  if (!/[A-Z]/.test(password)) errors.push("En az 1 büyük harf");
  if (!/[a-z]/.test(password)) errors.push("En az 1 küçük harf");
  if (!/[0-9]/.test(password)) errors.push("En az 1 rakam");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("En az 1 özel karakter");
  return { valid: errors.length === 0, errors };
}

// ============================================
// ARRAY UTILS
// ============================================

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function uniqueBy<T, K>(array: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  return array.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================
// OBJECT UTILS
// ============================================

export function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================
// ERROR HANDLING
// ============================================

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 400, details);
  }

  static unauthorized(code: string, message: string = "Yetkisiz erişim") {
    return new AppError(code, message, 401);
  }

  static forbidden(code: string, message: string = "Erişim engellendi") {
    return new AppError(code, message, 403);
  }

  static notFound(code: string, message: string = "Kaynak bulunamadı") {
    return new AppError(code, message, 404);
  }

  static conflict(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 409, details);
  }

  static internal(code: string, message: string = "Sunucu hatası", details?: Record<string, unknown>) {
    return new AppError(code, message, 500, details);
  }

  static validation(errors: Record<string, string[]>) {
    return new AppError("VALIDATION_ERROR", "Doğrulama hatası", 422, { errors });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// ============================================
// CRYPTO UTILS (for client-side helpers)
// ============================================

export function generateRandomString(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

export function generateToken(): string {
  return generateRandomString(64);
}

// ============================================
// PAGINATION
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function calculatePagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function getPaginationParams(page?: number | string, limit?: number | string): PaginationParams {
  const p = Math.max(1, parseInt(String(page ?? 1), 10));
  const l = Math.min(100, Math.max(1, parseInt(String(limit ?? 20), 10)));
  return { page: p, limit: l };
}

// ============================================
// SORTING
// ============================================

export type SortOrder = "asc" | "desc";

export interface SortParams {
  sortBy: string;
  sortOrder: SortOrder;
}

export function getSortParams(sortBy?: string, sortOrder?: string, allowedFields: string[] = []): SortParams {
  const order = sortOrder === "asc" ? "asc" : "desc";
  const field = allowedFields.includes(sortBy ?? "") ? sortBy : allowedFields[0] ?? "createdAt";
  return { sortBy: field ?? "createdAt", sortOrder: order };
}