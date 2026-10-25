// Destination Routes - CRUD, search, filter
import { FastifyInstance } from "fastify";
import { DestinationService } from "../services/destination.service";
import { validate, getValidatedBody, getValidatedQuery, getValidatedParams } from "../middleware/validation";
import { authenticate, optionalAuth, requireRole } from "../middleware/auth";
import { DestinationFilterSchema, CreateDestinationSchema, UpdateDestinationSchema, DestinationTranslationSchema } from "@turizm/shared";

export async function destinationRoutes(fastify: FastifyInstance) {
  // Get destination types
  fastify.get("/types", async () => {
    const types = await DestinationService.getTypes();
    return { success: true, data: types };
  });

  // Get provinces
  fastify.get("/provinces", async () => {
    const provinces = await DestinationService.getProvinces();
    return { success: true, data: provinces };
  });

  // Get districts by province
  fastify.get("/provinces/:provinceId/districts", async (request) => {
    const params = getValidatedParams<{ provinceId: string }>(request);
    const districts = await DestinationService.getDistricts(params.provinceId);
    return { success: true, data: districts };
  });

  // List destinations with filters (public)
  fastify.get(
    "/",
    { schema: { querystring: DestinationFilterSchema } },
    async (request) => {
      const query = getValidatedQuery<typeof DestinationFilterSchema._type>(request);
      const result = await DestinationService.list(query);
      return { success: true, ...result };
    }
  );

  // Get featured destinations
  fastify.get("/featured", async (request) => {
    const query = getValidatedQuery<{ limit?: string; language?: string }>(request);
    const limit = parseInt(query.limit || "10", 10);
    const language = query.language || "tr";
    const destinations = await DestinationService.getFeatured(limit, language);
    return { success: true, data: destinations };
  });

  // Get nearby destinations
  fastify.get("/nearby", async (request) => {
    const query = getValidatedQuery<{ lat: string; lon: string; radius?: string; limit?: string }>(request);
    const lat = parseFloat(query.lat);
    const lon = parseFloat(query.lon);
    const radius = parseFloat(query.radius || "10");
    const limit = parseInt(query.limit || "20", 10);

    if (isNaN(lat) || isNaN(lon)) {
      return { success: false, error: { code: "INVALID_COORDINATES", message: "Geçersiz koordinatlar" } };
    }

    const destinations = await DestinationService.getNearby(lat, lon, radius, limit);
    return { success: true, data: destinations };
  });

  // Get destination by slug (public)
  fastify.get("/slug/:slug", async (request) => {
    const params = getValidatedParams<{ slug: string }>(request);
    const query = getValidatedQuery<{ language?: string }>(request);
    const language = query.language || "tr";
    const destination = await DestinationService.getBySlug(params.slug, language);
    return { success: true, data: destination };
  });

  // Get destination by ID (public)
  fastify.get("/:id", async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const query = getValidatedQuery<{ language?: string }>(request);
    const language = query.language || "tr";
    const destination = await DestinationService.getById(params.id, language);

    // Increment view count
    DestinationService.incrementViewCount(params.id).catch(console.error);

    return { success: true, data: destination };
  });

  // Click tracking
  fastify.post("/:id/click", { preHandler: [optionalAuth] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    await DestinationService.incrementClickCount(
      params.id,
      request.user?.sub,
      request.ip,
      request.headers["user-agent"],
      request.headers.referer
    );
    return { success: true };
  });

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // Create destination (admin)
  fastify.post(
    "/",
    { preHandler: [authenticate, requireRole("ADMIN", "SUPER_ADMIN"), validate(CreateDestinationSchema)], schema: { body: CreateDestinationSchema } },
    async (request) => {
      const body = getValidatedBody<typeof CreateDestinationSchema._type>(request);
      const destination = await DestinationService.create(body, request.user!.sub);
      return { success: true, data: destination };
    }
  );

  // Update destination (admin)
  fastify.patch(
    "/:id",
    { preHandler: [authenticate, requireRole("ADMIN", "SUPER_ADMIN"), validate(UpdateDestinationSchema)], schema: { body: UpdateDestinationSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof UpdateDestinationSchema._type>(request);
      const destination = await DestinationService.update(params.id, body, request.user!.sub);
      return { success: true, data: destination };
    }
  );

  // Delete destination (admin)
  fastify.delete(
    "/:id",
    { preHandler: [authenticate, requireRole("ADMIN", "SUPER_ADMIN")] },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      await DestinationService.delete(params.id, request.user!.sub);
      return { success: true, data: { message: "Destinasyon silindi" } };
    }
  );

  // Add/update translation (admin)
  fastify.post(
    "/:id/translations",
    { preHandler: [authenticate, requireRole("ADMIN", "SUPER_ADMIN"), validate(DestinationTranslationSchema)], schema: { body: DestinationTranslationSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof DestinationTranslationSchema._type>(request);
      const translation = await DestinationService.upsertTranslation(params.id, body);
      return { success: true, data: translation };
    }
  );
}