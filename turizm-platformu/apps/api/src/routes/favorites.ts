// Favorite Routes - User favorites/bookmarks
import { FastifyInstance } from "fastify";
import { FavoriteService } from "../services/favorite.service";
import { authenticate } from "../middleware/auth";
import { getValidatedParams, getValidatedQuery } from "../middleware/validation";

export async function favoriteRoutes(fastify: FastifyInstance) {
  // Toggle favorite
  fastify.post("/:destinationId/toggle", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ destinationId: string }>(request);
    const result = await FavoriteService.toggle(request.user!.sub, params.destinationId);
    return { success: true, data: result };
  });

  // Check if favorited
  fastify.get("/:destinationId/status", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ destinationId: string }>(request);
    const favorited = await FavoriteService.isFavorited(request.user!.sub, params.destinationId);
    return { success: true, data: { favorited } };
  });

  // List user's favorites
  fastify.get("/", { preHandler: [authenticate] }, async (request) => {
    const query = getValidatedQuery<{ page?: number; limit?: number }>(request);
    const result = await FavoriteService.list(request.user!.sub, query);
    return { success: true, ...result };
  });

  // Get favorite count for destination
  fastify.get("/:destinationId/count", async (request) => {
    const params = getValidatedParams<{ destinationId: string }>(request);
    const count = await FavoriteService.getCount(params.destinationId);
    return { success: true, data: { count } };
  });

  // Remove favorite
  fastify.delete("/:destinationId", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ destinationId: string }>(request);
    await FavoriteService.remove(request.user!.sub, params.destinationId);
    return { success: true, data: { message: "Favorilerden çıkarıldı" } };
  });

  // Clear all favorites
  fastify.delete("/", { preHandler: [authenticate] }, async (request) => {
    await FavoriteService.clearAll(request.user!.sub);
    return { success: true, data: { message: "Tüm favoriler temizlendi" } };
  });
}