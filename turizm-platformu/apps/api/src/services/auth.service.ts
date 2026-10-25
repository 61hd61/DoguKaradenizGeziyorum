// Auth Service - Password hashing, JWT tokens, email verification
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";
import { config } from "../config";
import { AppError, generateToken } from "@turizm/shared";

export interface TokenPayload {
  sub: string; // user ID
  email: string;
  username: string;
  role: string;
  type: "access" | "refresh";
}

export interface JWTPayload extends TokenPayload {
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export class AuthService {
  // Hash password with bcrypt
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password
  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  // Generate access token (short-lived)
  static generateAccessToken(payload: Omit<TokenPayload, "type">): string {
    return jwt.sign(
      { ...payload, type: "access" },
      config.jwt.secret,
      {
        expiresIn: config.jwt.accessTokenExpiry as jwt.SignOptions["expiresIn"],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }
    );
  }

  // Generate refresh token (long-lived)
  static generateRefreshToken(payload: Omit<TokenPayload, "type">): string {
    return jwt.sign(
      { ...payload, type: "refresh" },
      config.jwt.secret,
      {
        expiresIn: config.jwt.refreshTokenExpiry as jwt.SignOptions["expiresIn"],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }
    );
  }

  // Verify and decode token
  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized("TOKEN_EXPIRED", "Token süresi dolmuş");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw AppError.unauthorized("INVALID_TOKEN", "Geçersiz token");
      }
      throw AppError.unauthorized("TOKEN_ERROR", "Token doğrulama hatası");
    }
  }

  // Store refresh token in database
  static async storeRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  // Revoke refresh token
  static async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { token },
      data: { revoked: true },
    });
  }

  // Revoke all user refresh tokens
  static async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  // Validate refresh token
  static async validateRefreshToken(token: string): Promise<{ userId: string } | null> {
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return null;
    }

    return { userId: stored.userId };
  }

  // Create email verification token
  static async createEmailVerificationToken(email: string): Promise<string> {
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    await prisma.emailVerificationToken.create({
      data: { email, token, expiresAt },
    });

    return token;
  }

  // Verify email token
  static async verifyEmailToken(token: string): Promise<string | null> {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      return null;
    }

    // Delete token after use
    await prisma.emailVerificationToken.delete({ where: { token } });

    return record.email;
  }

  // Create password reset token
  static async createPasswordResetToken(email: string): Promise<string> {
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    return token;
  }

  // Verify password reset token
  static async verifyPasswordResetToken(token: string): Promise<string | null> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date() || record.used) {
      return null;
    }

    return record.email;
  }

  // Mark password reset token as used
  static async usePasswordResetToken(token: string): Promise<void> {
    await prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    });
  }

  // Generate token pair for user
  static generateTokenPair(user: { id: string; email: string; username: string; role: string }): { accessToken: string; refreshToken: string } {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  // Decode token without verification (for reading payload)
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }
}