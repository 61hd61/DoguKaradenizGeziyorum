// Admin Service - Admin panel operations
import { prisma } from "../utils/prisma";
import { AuthService } from "./auth.service";
import { AppError, calculatePagination, getPaginationParams } from "@turizm/shared";
import { AdminCreateUserSchema, AdminUpdateDestinationSchema, AdminReviewActionSchema } from "@turizm/shared";
import { z } from "zod";

export class AdminService {
  // ============================================
  // ADMIN AUTH
  // ============================================

  static async login(email: string, password: string) {
    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !admin.isActive) {
      throw AppError.unauthorized("INVALID_CREDENTIALS", "Geçersiz kimlik bilgileri");
    }

    const isValid = await AuthService.verifyPassword(admin.passwordHash, password);
    if (!isValid) {
      throw AppError.unauthorized("INVALID_CREDENTIALS", "Geçersiz kimlik bilgileri");
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = AuthService.generateTokenPair({
      id: admin.id,
      email: admin.email,
      username: admin.name,
      role: admin.role,
    });

    await AuthService.storeRefreshToken(admin.id, tokens.refreshToken);

    const { passwordHash, ...safeAdmin } = admin;
    return { admin: safeAdmin, ...tokens };
  }

  // ============================================
  // USER MANAGEMENT (Admin panel)
  // ============================================

  static async listUsers(filters: { search?: string; role?: string; page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const where: any = {};
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: "insensitive" } },
        { username: { contains: filters.search, mode: "insensitive" } },
        { profile: { firstName: { contains: filters.search, mode: "insensitive" } } },
        { profile: { lastName: { contains: filters.search, mode: "insensitive" } } },
      ];
    }
    if (filters.role) where.role = filters.role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: { select: { firstName: true, lastName: true, bio: true } },
          _count: { select: { reviews: true, favorites: true, tours: true, posts: true, followers: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Remove password hashes
    const safeUsers = users.map(({ passwordHash, ...u }) => u);

    return { data: safeUsers, meta: calculatePagination(page, limit, total) };
  }

  static async getUserDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        reviews: { include: { destination: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
        favorites: { include: { destination: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
        tours: { orderBy: { createdAt: "desc" }, take: 10 },
        posts: { orderBy: { createdAt: "desc" }, take: 10 },
        _count: { select: { reviews: true, favorites: true, tours: true, posts: true, followers: true, following: true } },
      },
    });

    if (!user) throw AppError.notFound("USER_NOT_FOUND", "Kullanıcı bulunamadı");

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  static async createUser(adminId: string, data: z.infer<typeof AdminCreateUserSchema>) {
    const existingEmail = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existingEmail) throw AppError.conflict("EMAIL_EXISTS", "E-posta zaten kullanılıyor");

    const passwordHash = await AuthService.hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: `@${data.email.split("@")[0]}${Date.now().toString(36).slice(-4)}`,
        passwordHash,
        role: data.role === "SUPER_ADMIN" ? "ADMIN" : "USER",
      },
    });

    await prisma.auditLog.create({
      data: { adminId, action: "CREATE", entityType: "USER", entityId: user.id, newData: { email: user.email, role: user.role } },
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  static async updateUser(adminId: string, userId: string, data: { role?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: data.role as any },
    });

    await prisma.auditLog.create({
      data: { adminId, action: "UPDATE", entityType: "USER", entityId: userId, newData: data },
    });

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  static async deleteUser(adminId: string, userId: string) {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.auditLog.create({ data: { adminId, action: "DELETE", entityType: "USER", entityId: userId } });
  }

  // ============================================
  // DESTINATION MANAGEMENT
  // ============================================

  static async listDestinations(filters: { search?: string; provinceId?: string; typeId?: string; isActive?: boolean; page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const where: any = {};
    if (filters.search) where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.provinceId) where.provinceId = filters.provinceId;
    if (filters.typeId) where.typeId = filters.typeId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [destinations, total] = await Promise.all([
      prisma.destination.findMany({
        where,
        include: { type: true, province: true, district: true, _count: { select: { reviews: true, favorites: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.destination.count({ where }),
    ]);

    return { data: destinations, meta: calculatePagination(page, limit, total) };
  }

  static async updateDestination(adminId: string, destinationId: string, data: z.infer<typeof AdminUpdateDestinationSchema>) {
    const existing = await prisma.destination.findUnique({ where: { id: destinationId } });
    if (!existing) throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");

    const updated = await prisma.destination.update({
      where: { id: destinationId },
      data,
      include: { type: true, province: true, district: true },
    });

    await prisma.auditLog.create({
      data: { adminId, action: "UPDATE", entityType: "DESTINATION", entityId: destinationId, oldData: existing, newData: updated },
    });

    return updated;
  }

  // ============================================
  // REVIEW MODERATION
  // ============================================

  static async listReviews(filters: { destinationId?: string; isApproved?: boolean; page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const where: any = {};
    if (filters.destinationId) where.destinationId = filters.destinationId;
    if (filters.isApproved !== undefined) where.isApproved = filters.isApproved;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { user: { select: { id: true, username: true, email: true } }, destination: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { data: reviews, meta: calculatePagination(page, limit, total) };
  }

  static async moderateReview(adminId: string, data: z.infer<typeof AdminReviewActionSchema>) {
    const review = await prisma.review.findUnique({ where: { id: data.reviewId }, include: { destination: true } });
    if (!review) throw AppError.notFound("REVIEW_NOT_FOUND", "Yorum bulunamadı");

    if (data.action === "APPROVE") {
      const updated = await prisma.review.update({
        where: { id: data.reviewId },
        data: { isApproved: true, approvedAt: new Date(), approvedBy: adminId },
      });

      // Update destination stats
      const stats = await prisma.review.aggregate({
        where: { destinationId: review.destinationId, isApproved: true },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await prisma.destination.update({
        where: { id: review.destinationId },
        data: { averageRating: stats._avg.rating ? Math.round(stats._avg.rating * 100) / 100 : 0, reviewCount: stats._count.rating },
      });

      await prisma.auditLog.create({ data: { adminId, action: "APPROVE", entityType: "REVIEW", entityId: data.reviewId } });
      return updated;
    } else {
      await prisma.review.delete({ where: { id: data.reviewId } });
      await prisma.auditLog.create({ data: { adminId, action: "REJECT", entityType: "REVIEW", entityId: data.reviewId } });
      return { deleted: true };
    }
  }

  // ============================================
  // ANALYTICS / STATS
  // ============================================

  static async getDashboardStats() {
    const [
      totalUsers,
      totalDestinations,
      totalReviews,
      totalTours,
      totalPosts,
      pendingReviews,
      recentUsers,
      recentReviews,
      topDestinations,
      userGrowth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.destination.count({ where: { isActive: true } }),
      prisma.review.count(),
      prisma.userTour.count(),
      prisma.post.count(),
      prisma.review.count({ where: { isApproved: false } }),
      prisma.user.findMany({ take: 5, orderBy: { createdAt: "desc" }, select: { id: true, username: true, email: true, createdAt: true } }),
      prisma.review.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { user: { select: { username: true } }, destination: { select: { name: true } } } }),
      prisma.destination.findMany({ take: 10, orderBy: { viewCount: "desc" }, select: { id: true, name: true, viewCount: true, clickCount: true, averageRating: true, reviewCount: true } }),
      prisma.$queryRaw`
        SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*) as count
        FROM "User"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `,
    ]);

    return {
      totals: { users: totalUsers, destinations: totalDestinations, reviews: totalReviews, tours: totalTours, posts: totalPosts, pendingReviews },
      recentUsers,
      recentReviews,
      topDestinations,
      userGrowth,
    };
  }

  static async getClickAnalytics(filters: { destinationId?: string; startDate?: Date; endDate?: Date } = {}) {
    const where: any = {};
    if (filters.destinationId) where.destinationId = filters.destinationId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const clicks = await prisma.click.groupBy({
      by: ["destinationId"],
      where,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    const destinationIds = clicks.map((c) => c.destinationId);
    const destinations = await prisma.destination.findMany({
      where: { id: { in: destinationIds } },
      select: { id: true, name: true, province: { select: { name: true } } },
    });

    return clicks.map((c) => ({
      destinationId: c.destinationId,
      clickCount: c._count.id,
      destination: destinations.find((d) => d.id === c.destinationId),
    }));
  }

  static async getPopularRoutes() {
    return prisma.popularRoute.findMany({
      where: { isActive: true },
      orderBy: { usageCount: "desc" },
      take: 20,
    });
  }

  // ============================================
  // AUDIT LOGS
  // ============================================

  static async getAuditLogs(filters: { adminId?: string; entityType?: string; page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const where: any = {};
    if (filters.adminId) where.adminId = filters.adminId;
    if (filters.entityType) where.entityType = filters.entityType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { admin: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data: logs, meta: calculatePagination(page, limit, total) };
  }
}