// Review Service - Reviews, ratings, likes
import { prisma } from "../utils/prisma";
import { AppError, calculatePagination, getPaginationParams, getSortParams } from "@turizm/shared";
import { CreateReviewInput, UpdateReviewInput, ReviewFilterInput } from "@turizm/shared";

export class ReviewService {
  // Create review
  static async create(userId: string, data: CreateReviewInput) {
    // Check if destination exists and is active
    const destination = await prisma.destination.findUnique({
      where: { id: data.destinationId },
      select: { id: true, isActive: true },
    });

    if (!destination || !destination.isActive) {
      throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");
    }

    // Check if user already reviewed this destination
    const existing = await prisma.review.findFirst({
      where: { userId, destinationId: data.destinationId },
    });

    if (existing) {
      throw AppError.conflict("REVIEW_EXISTS", "Bu destinasyon için zaten yorum yapmışsınız");
    }

    const review = await prisma.review.create({
      data: {
        userId,
        destinationId: data.destinationId,
        category: data.category,
        content: data.content,
        rating: data.rating,
        isApproved: false, // Requires admin approval
      },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    return review;
  }

  // Get review by ID
  static async getById(id: string) {
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } },
        },
        destination: { select: { id: true, name: true, slug: true } },
        _count: { select: { likes: true } },
      },
    });

    if (!review) {
      throw AppError.notFound("REVIEW_NOT_FOUND", "Yorum bulunamadı");
    }

    return review;
  }

  // Update review (owner only)
  static async update(userId: string, reviewId: string, data: UpdateReviewInput) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw AppError.notFound("REVIEW_NOT_FOUND", "Yorum bulunamadı");
    }

    if (review.userId !== userId) {
      throw AppError.forbidden("NOT_OWNER", "Bu yorumu düzenleme yetkiniz yok");
    }

    // If approved, reset approval status on update
    const updateData: any = { ...data };
    if (review.isApproved) {
      updateData.isApproved = false;
      updateData.approvedAt = null;
      updateData.approvedBy = null;
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: updateData,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });

    return updated;
  }

  // Delete review (owner or admin)
  static async delete(userId: string, reviewId: string, isAdmin: boolean = false) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw AppError.notFound("REVIEW_NOT_FOUND", "Yorum bulunamadı");
    }

    if (review.userId !== userId && !isAdmin) {
      throw AppError.forbidden("NOT_OWNER", "Bu yorumu silme yetkiniz yok");
    }

    await prisma.review.delete({ where: { id: reviewId } });
  }

  // List reviews with filters
  static async list(filters: ReviewFilterInput) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);
    const { sortBy, sortOrder } = getSortParams(filters.sortBy, filters.sortOrder, [
      "createdAt", "rating"
    ]);

    const where: any = {};

    if (filters.destinationId) where.destinationId = filters.destinationId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.category) where.category = filters.category;
    if (filters.isApproved !== undefined) where.isApproved = filters.isApproved;
    if (filters.minRating) where.rating = { ...where.rating, gte: filters.minRating };
    if (filters.maxRating) where.rating = { ...where.rating, lte: filters.maxRating };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } },
          },
          destination: { select: { id: true, name: true, slug: true } },
          _count: { select: { likes: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: calculatePagination(page, limit, total),
    };
  }

  // Get reviews for a destination (public - only approved)
  static async getForDestination(destinationId: string, filters: { category?: string; page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const where: any = { destinationId, isApproved: true };
    if (filters.category) where.category = filters.category;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { data: reviews, meta: calculatePagination(page, limit, total) };
  }

  // Like/unlike review
  static async toggleLike(userId: string, reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { _count: { select: { likes: true } } },
    });
    if (!review) {
      throw AppError.notFound("REVIEW_NOT_FOUND", "Yorum bulunamadı");
    }

    const existingLike = await prisma.reviewLike.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });

    if (existingLike) {
      await prisma.reviewLike.delete({ where: { id: existingLike.id } });
      return { liked: false, likeCount: review._count.likes - 1 };
    } else {
      await prisma.reviewLike.create({ data: { reviewId, userId } });
      return { liked: true, likeCount: review._count.likes + 1 };
    }
  }

  // Check if user liked review
  static async hasLiked(userId: string, reviewId: string): Promise<boolean> {
    const like = await prisma.reviewLike.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });
    return !!like;
  }

  // Admin: Approve/reject review
  static async moderate(reviewId: string, action: "APPROVE" | "REJECT", adminId: string) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw AppError.notFound("REVIEW_NOT_FOUND", "Yorum bulunamadı");
    }

    if (action === "APPROVE") {
      const updated = await prisma.review.update({
        where: { id: reviewId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: adminId,
        },
        include: {
          user: { select: { id: true, username: true, email: true } },
          destination: { select: { id: true, name: true } },
        },
      });

      // Update destination average rating and review count
      await this.updateDestinationStats(review.destinationId);

      return updated;
    } else {
      await prisma.review.delete({ where: { id: reviewId } });
      return { deleted: true };
    }
  }

  // Update destination rating stats
  static async updateDestinationStats(destinationId: string) {
    const stats = await prisma.review.aggregate({
      where: { destinationId, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.destination.update({
      where: { id: destinationId },
      data: {
        averageRating: stats._avg.rating ? Math.round(stats._avg.rating * 100) / 100 : 0,
        reviewCount: stats._count.rating,
      },
    });
  }

  // Get review stats for destination
  static async getDestinationStats(destinationId: string) {
    const [total, approved, ratingDistribution] = await Promise.all([
      prisma.review.count({ where: { destinationId } }),
      prisma.review.count({ where: { destinationId, isApproved: true } }),
      prisma.review.groupBy({
        by: ["rating"],
        where: { destinationId, isApproved: true },
        _count: { rating: true },
      }),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingDistribution.forEach((r) => {
      distribution[r.rating as keyof typeof distribution] = r._count.rating;
    });

    const avgRating = await prisma.destination.findUnique({
      where: { id: destinationId },
      select: { averageRating: true },
    });

    return {
      total,
      approved,
      pending: total - approved,
      averageRating: Number(avgRating?.averageRating || 0),
      distribution,
    };
  }
}