// Auth Middleware - JWT verification, role checks
import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService, TokenPayload } from "../services/auth.service";
import { AppError } from "@turizm/shared";
import { prisma } from "../utils/prisma";

// Extend the JWT user type
declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: TokenPayload;
    admin: TokenPayload;
  }
}

// Also extend FastifyRequest for admin
declare module "fastify" {
  interface FastifyRequest {
    admin?: TokenPayload;
  }
}

// Verify access token and attach user
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw AppError.unauthorized("NO_TOKEN", "Yetkilendirme token'ı gereklidir");
    }

    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);

    if (payload.type !== "access") {
      throw AppError.unauthorized("INVALID_TOKEN_TYPE", "Geçersiz token türü");
    }

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });

    if (!user) {
      throw AppError.unauthorized("USER_NOT_FOUND", "Kullanıcı bulunamadı");
    }

    request.user = payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unauthorized("TOKEN_ERROR", "Token doğrulama hatası");
  }
}

// Optional authentication (doesn't throw if no token)
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return;
    }

    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);

    if (payload.type === "access") {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });

      if (user) {
        request.user = payload;
      }
    }
  } catch {
    // Ignore errors for optional auth
  }
}

// Verify admin token
export async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw AppError.unauthorized("NO_TOKEN", "Admin token'ı gereklidir");
    }

    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);

    if (payload.type !== "access") {
      throw AppError.unauthorized("INVALID_TOKEN_TYPE", "Geçersiz token türü");
    }

    // Check if admin exists
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub, isActive: true },
    });

    if (!admin) {
      throw AppError.unauthorized("ADMIN_NOT_FOUND", "Admin bulunamadı");
    }

    request.admin = payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unauthorized("TOKEN_ERROR", "Admin token doğrulama hatası");
  }
}

// Role-based access control
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw AppError.unauthorized("NOT_AUTHENTICATED", "Giriş yapmanız gerekiyor");
    }

    if (!roles.includes(request.user.role)) {
      throw AppError.forbidden("INSUFFICIENT_PERMISSIONS", "Bu işlem için yetkiniz yok");
    }
  };
}

// Admin role check
export function requireAdminRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.admin) {
      throw AppError.unauthorized("NOT_AUTHENTICATED", "Admin girişi gerekiyor");
    }

    if (!roles.includes(request.admin.role)) {
      throw AppError.forbidden("INSUFFICIENT_PERMISSIONS", "Bu işlem için admin yetkiniz yok");
    }
  };
}

// Rate limiting key generator
export function rateLimitKeyGenerator(request: FastifyRequest): string {
  const ip = request.ip;
  const userId = request.user?.sub || "anonymous";
  return `${ip}:${userId}:${request.routeOptions.url}`;
}