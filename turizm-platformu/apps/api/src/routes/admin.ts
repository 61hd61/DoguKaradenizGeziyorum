// Admin Routes - Admin panel operations
import { FastifyInstance } from "fastify";
import { AdminService } from "../services/admin.service";
import { authenticate, requireRole } from "../middleware/auth";
import { AdminCreateUserSchema, AdminUpdateDestinationSchema, AdminReviewActionSchema } from "@turizm/shared";
import { getValidatedBody, getValidatedQuery, getValidatedParams } from "../middleware/validation";

export async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require ADMIN or SUPER_ADMIN role
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("ADMIN", "SUPER_ADMIN"));

  // ============================================
  // DASHBOARD / STATS
  // ============================================

  fastify.get("/stats", async () => {
    const stats = await AdminService.getDashboardStats();
    return { success: true, data: stats };
  });

  // ============================================
  // USER MANAGEMENT
  // ============================================

  fastify.get("/users", async (request) => {
    const query = getValidatedQuery<{ search?: string; role?: string; page?: number; limit?: number }>(request);
    const result = await AdminService.listUsers(query);
    return { success: true, ...result };
  });

  fastify.get("/users/:id", async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const user = await AdminService.getUserDetails(params.id);
    return { success: true, data: user };
  });

  fastify.post(
    "/users",
    { schema: { body: AdminCreateUserSchema } },
    async (request) => {
      const body = getValidatedBody<typeof AdminCreateUserSchema._type>(request);
      const user = await AdminService.createUser(request.user!.sub, body);
      return { success: true, data: user };
    }
  );

  fastify.patch("/users/:id", async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const body = getValidatedBody<{ role?: string }>(request);
    const user = await AdminService.updateUser(request.user!.sub, params.id, body);
    return { success: true, data: user };
  });

  fastify.delete("/users/:id", async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    await AdminService.deleteUser(request.user!.sub, params.id);
    return { success: true, data: { message: "Kullanıcı silindi" } };
  });

  // ============================================
  // DESTINATION MANAGEMENT
  // ============================================

  fastify.get("/destinations", async (request) => {
    const query = getValidatedQuery<{ search?: string; provinceId?: string; typeId?: string; isActive?: boolean; page?: number; limit?: number }>(request);
    const result = await AdminService.listDestinations(query);
    return { success: true, ...result };
  });

  fastify.patch(
    "/destinations/:id",
    { schema: { body: AdminUpdateDestinationSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof AdminUpdateDestinationSchema._type>(request);
      const destination = await AdminService.updateDestination(request.user!.sub, params.id, body);
      return { success: true, data: destination };
    }
  );

  // ============================================
  // REVIEW MODERATION
  // ============================================

  fastify.get("/reviews", async (request) => {
    const query = getValidatedQuery<{ destinationId?: string; isApproved?: string; page?: number; limit?: number }>(request);
    let isApproved: boolean | undefined;
    if (query.isApproved === "true") isApproved = true;
    else if (query.isApproved === "false") isApproved = false;
    const result = await AdminService.listReviews({ ...query, isApproved });
    return { success: true, ...result };
  });

  fastify.post(
    "/reviews/:id/moderate",
    { schema: { body: AdminReviewActionSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof AdminReviewActionSchema._type>(request);
      const result = await AdminService.moderateReview(request.user!.sub, { reviewId: params.id, action: body.action });
      return { success: true, data: result };
    }
  );

  // ============================================
  // ANALYTICS
  // ============================================

  fastify.get("/analytics/clicks", async (request) => {
    const query = getValidatedQuery<{ destinationId?: string; startDate?: string; endDate?: string }>(request);
    const clicks = await AdminService.getClickAnalytics({
      destinationId: query.destinationId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
    return { success: true, data: clicks };
  });

  fastify.get("/analytics/popular-routes", async () => {
    const routes = await AdminService.getPopularRoutes();
    return { success: true, data: routes };
  });

  // ============================================
  // AUDIT LOGS
  // ============================================

  fastify.get("/audit-logs", async (request) => {
    const query = getValidatedQuery<{ adminId?: string; entityType?: string; page?: number; limit?: number }>(request);
    const result = await AdminService.getAuditLogs(query);
    return { success: true, ...result };
  });
}