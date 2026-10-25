// Favorite Service - User favorites/bookmarks
import { prisma } from "../utils/prisma";
import { AppError, calculatePagination, getPaginationParams } from "@turizm/shared";

export class FavoriteService {
  // Toggle favorite
  static async toggle(userId: string, destinationId: string) {
    const destination = await prisma.destination.findUnique({ where: { id: destinationId } });
    if (!destination) {
      throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_destinationId: { userId, destinationId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    } else {
      await prisma.favorite.create({ data: { userId, destinationId } });
      return { favorited: true };
    }
  }

  // Check if favorited
  static async isFavorited(userId: string, destinationId: string): Promise<boolean> {
    const favorite = await prisma.favorite.findUnique({
      where: { userId_destinationId: { userId, destinationId } },
    });
    return !!favorite;
  }

  // List user's favorites
  static async list(userId: string, filters: { page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        include: {
          destination: {
            include: { type: true, province: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.favorite.count({ where: { userId } }),
    ]);

    return {
      data: favorites.map((f) => f.destination),
      meta: calculatePagination(page, limit, total),
    };
  }

  // Get favorite count for destination
  static async getCount(destinationId: string): Promise<number> {
    return prisma.favorite.count({ where: { destinationId } });
  }

  // Remove favorite
  static async remove(userId: string, destinationId: string): Promise<void> {
    await prisma.favorite.deleteMany({ where: { userId, destinationId } });
  }

  // Clear all favorites
  static async clearAll(userId: string): Promise<void> {
    await prisma.favorite.deleteMany({ where: { userId } });
  }
}