// Review Routes - Reviews, ratings, likes
import { FastifyInstance } from "fastify";
import { ReviewService } from "../services/review.service";
import { validate, getValidatedBody, getValidatedQuery, getValidatedParams } from "../middleware/validation";
import { authenticate, requireRole } from "../middleware/auth";
import { CreateReviewSchema, UpdateReviewSchema, ReviewFilterSchema } from "@turizm/shared";

export async function reviewRoutes(fastify: FastifyInstance) {
  // Create review
  fastify.post(
    "/",
    { preHandler: [authenticate, validate(CreateReviewSchema)], schema: { body: CreateReviewSchema } },
    async (request) => {
      const body = getValidatedBody<typeof CreateReviewSchema._type>(request);
      const review = await ReviewService.create(request.user!.sub, body);
      return { success: true, data: review };
    }
  );

  // Get user's reviews
  fastify.get("/my", { preHandler: [authenticate] }, async (request) => {
    const query = getValidatedQuery<typeof ReviewFilterSchema._type>(request);
    const result = await ReviewService.list({ userId: request.user!.sub, ...query });
    return { success: true, ...result };
  });

  // Get review by ID
  fastify.get("/:id", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const review = await ReviewService.getById(params.id);
    return { success: true, data: review };
  });

  // Update review (owner)
  fastify.patch(
    "/:id",
    { preHandler: [authenticate, validate(UpdateReviewSchema)], schema: { body: UpdateReviewSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof UpdateReviewSchema._type>(request);
      const review = await ReviewService.update(request.user!.sub, params.id, body);
      return { success: true, data: review };
    }
  );

  // Delete review (owner or admin)
  fastify.delete(
    "/:id",
    { preHandler: [authenticate] },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const isAdmin = request.user!.role === "ADMIN" || request.user!.role === "SUPER_ADMIN";
      await ReviewService.delete(request.user!.sub, params.id, isAdmin);
      return { success: true, data: { message: "Yorum silindi" } };
    }
  );

  // Get reviews for a destination (public - approved only)
  fastify.get("/destination/:destinationId", async (request) => {
    const params = getValidatedParams<{ destinationId: string }>(request);
    const query = getValidatedQuery<typeof ReviewFilterSchema._type>(request);
    const result = await ReviewService.getForDestination(params.destinationId, query);
    return { success: true, ...result };
  });

  // Like/unlike review
  fastify.post("/:id/like", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const result = await ReviewService.toggleLike(request.user!.sub, params.id);
    return { success: true, data: result };
  });

  // Check if user liked review
  fastify.get("/:id/like", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const liked = await ReviewService.hasLiked(request.user!.sub, params.id);
    return { success: true, data: { liked } };
  });

  // Get review stats for destination
  fastify.get("/destination/:destinationId/stats", async (request) => {
    const params = getValidatedParams<{ destinationId: string }>(request);
    const stats = await ReviewService.getDestinationStats(params.destinationId);
    return { success: true, data: stats };
  });

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // List all reviews (admin)
  fastify.get(
    "/",
    { preHandler: [authenticate, requireRole("ADMIN", "SUPER_ADMIN")], schema: { querystring: ReviewFilterSchema } },
    async (request) => {
      const query = getValidatedQuery<typeof ReviewFilterSchema._type>(request);
      const result = await ReviewService.list(query);
      return { success: true, ...result };
    }
  );

  // Moderate review (admin)
  fastify.post(
    "/:id/moderate",
    { preHandler: [authenticate, requireRole("ADMIN", "SUPER_ADMIN")], schema: { body: { type: "object", properties: { action: { type: "string", enum: ["APPROVE", "REJECT"] } }, required: ["action"] }, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<{ action: "APPROVE" | "REJECT" }>(request);
      const result = await ReviewService.moderate(params.id, body.action, request.user!.sub);
      return { success: true, data: result };
    }
  );
}