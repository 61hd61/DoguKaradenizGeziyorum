// User Service - User CRUD operations
import { prisma } from "../utils/prisma";
import { AuthService } from "./auth.service";
import { emailService } from "./email.service";
import { AppError, generateUsername, slugify } from "@turizm/shared";
import { RegisterInput, UpdateProfileInput, ChangePasswordInput } from "@turizm/shared";

export class UserService {
  // Register new user
  static async register(data: RegisterInput) {
    // Check if email exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existingEmail) {
      throw AppError.conflict("EMAIL_EXISTS", "Bu e-posta adresi zaten kayıtlı");
    }

    // Check if username exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username.toLowerCase() },
    });
    if (existingUsername) {
      throw AppError.conflict("USERNAME_EXISTS", "Bu kullanıcı adı zaten kullanılıyor");
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(data.password);

    // Generate username if not provided (but we require it in schema)
    const username = data.username.toLowerCase();

    // Create user and profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          username,
          passwordHash,
          role: "USER",
        },
      });

      await tx.userProfile.create({
        data: {
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      return user;
    });

    // Create email verification token
    const verificationToken = await AuthService.createEmailVerificationToken(result.email);

    // Send verification email (non-blocking)
    emailService.sendVerificationEmail(result.email, username, verificationToken).catch(console.error);

    return result;
  }

  // Login user
  static async login(identifier: string, password: string) {
    // Find by email or username
    const isEmail = identifier.includes("@");
    const user = await prisma.user.findUnique({
      where: isEmail ? { email: identifier.toLowerCase() } : { username: identifier.toLowerCase() },
      include: { profile: true },
    });

    if (!user) {
      throw AppError.unauthorized("INVALID_CREDENTIALS", "E-posta/kullanıcı adı veya şifre hatalı");
    }

    // Verify password
    const isValid = await AuthService.verifyPassword(user.passwordHash, password);
    if (!isValid) {
      throw AppError.unauthorized("INVALID_CREDENTIALS", "E-posta/kullanıcı adı veya şifre hatalı");
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = AuthService.generateTokenPair({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    // Store refresh token
    await AuthService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        avatarUrl: user.avatarUrl,
        profile: user.profile,
      },
      ...tokens,
    };
  }

  // Refresh access token
  static async refreshToken(refreshToken: string) {
    const validation = await AuthService.validateRefreshToken(refreshToken);
    if (!validation) {
      throw AppError.unauthorized("INVALID_REFRESH_TOKEN", "Geçersiz veya süresi dolmuş refresh token");
    }

    const user = await prisma.user.findUnique({
      where: { id: validation.userId },
      include: { profile: true },
    });

    if (!user) {
      throw AppError.unauthorized("USER_NOT_FOUND", "Kullanıcı bulunamadı");
    }

    // Generate new token pair
    const tokens = AuthService.generateTokenPair({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    // Revoke old refresh token and store new one
    await AuthService.revokeRefreshToken(refreshToken);
    await AuthService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        avatarUrl: user.avatarUrl,
        profile: user.profile,
      },
      ...tokens,
    };
  }

  // Logout (revoke refresh token)
  static async logout(refreshToken: string): Promise<void> {
    await AuthService.revokeRefreshToken(refreshToken);
  }

  // Logout from all devices
  static async logoutAll(userId: string): Promise<void> {
    await AuthService.revokeAllUserTokens(userId);
  }

  // Verify email
  static async verifyEmail(token: string): Promise<void> {
    const email = await AuthService.verifyEmailToken(token);
    if (!email) {
      throw AppError.badRequest("INVALID_VERIFICATION_TOKEN", "Geçersiz veya süresi dolmuş doğrulama kodu");
    }

    await prisma.user.update({
      where: { email },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Send welcome email
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      emailService.sendWelcomeEmail(email, user.username).catch(console.error);
    }
  }

  // Request password reset
  static async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success for security (don't reveal if email exists)
    if (!user) return;

    const token = await AuthService.createPasswordResetToken(user.email);
    await emailService.sendPasswordResetEmail(user.email, user.username, token);
  }

  // Reset password
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const email = await AuthService.verifyPasswordResetToken(token);
    if (!email) {
      throw AppError.badRequest("INVALID_RESET_TOKEN", "Geçersiz veya süresi dolmuş sıfırlama kodu");
    }

    const passwordHash = await AuthService.hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { email },
        data: { passwordHash },
      });

      await AuthService.usePasswordResetToken(token);
      await tx.refreshToken.deleteMany({ where: { user: { email } } });
    });
  }

  // Get user by ID (with profile)
  static async getById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        _count: {
          select: {
            reviews: true,
            favorites: true,
            tours: true,
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound("USER_NOT_FOUND", "Kullanıcı bulunamadı");
    }

    // Don't return password hash
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Update profile
  static async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound("USER_NOT_FOUND", "Kullanıcı bulunamadı");
    }

    // Check username uniqueness if changing
    if (data.avatarUrl !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: data.avatarUrl || null },
      });
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        bio: data.bio,
        preferences: (data.preferences as any) || null,
      },
      create: {
        userId,
        firstName: data.firstName || user.username.replace("@", ""),
        lastName: data.lastName || "",
        bio: data.bio,
        preferences: (data.preferences as any) || null,
      },
    });

    return profile;
  }

  // Change password
  static async changePassword(userId: string, data: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound("USER_NOT_FOUND", "Kullanıcı bulunamadı");
    }

    // Verify current password
    const isValid = await AuthService.verifyPassword(user.passwordHash, data.currentPassword);
    if (!isValid) {
      throw AppError.unauthorized("INVALID_CURRENT_PASSWORD", "Mevcut şifre hatalı");
    }

    // Hash new password
    const passwordHash = await AuthService.hashPassword(data.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      // Revoke all refresh tokens to force re-login
      await tx.refreshToken.deleteMany({ where: { userId } });
    });
  }

  // Delete account
  static async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound("USER_NOT_FOUND", "Kullanıcı bulunamadı");
    }

    const isValid = await AuthService.verifyPassword(user.passwordHash, password);
    if (!isValid) {
      throw AppError.unauthorized("INVALID_PASSWORD", "Şifre hatalı");
    }

    await prisma.user.delete({ where: { id: userId } });
  }

  // Search users
  static async search(query: string, limit: number = 10) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query.toLowerCase(), mode: "insensitive" } },
          { profile: { firstName: { contains: query, mode: "insensitive" } } },
          { profile: { lastName: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        profile: { select: { firstName: true, lastName: true } },
        _count: { select: { followers: true } },
      },
      take: limit,
    });

    return users;
  }

  // Get public profile by username
  static async getPublicProfile(username: string) {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: {
        profile: true,
        _count: {
          select: {
            reviews: true,
            favorites: true,
            tours: true,
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound("USER_NOT_FOUND", "Kullanıcı bulunamadı");
    }

    const { passwordHash, email, isEmailVerified, emailVerifiedAt, lastLoginAt, role, ...safeUser } = user;
    return safeUser;
  }
}