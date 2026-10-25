// Tour Routes - Tour planning, routing, suggestions
import { FastifyInstance } from "fastify";
import { TourService } from "../services/tour.service";
import { validate, getValidatedBody, getValidatedQuery, getValidatedParams } from "../middleware/validation";
import { authenticate } from "../middleware/auth";
import { CreateTourSchema, UpdateTourSchema, TourDestinationSchema, ReorderTourDestinationsSchema, TourSuggestionSchema } from "@turizm/shared";

export async function tourRoutes(fastify: FastifyInstance) {
  // Create tour
  fastify.post(
    "/",
    { preHandler: [authenticate, validate(CreateTourSchema)], schema: { body: CreateTourSchema } },
    async (request) => {
      const body = getValidatedBody<typeof CreateTourSchema._type>(request);
      const tour = await TourService.create(request.user!.sub, body);
      return { success: true, data: tour };
    }
  );

  // List user's tours
  fastify.get("/", { preHandler: [authenticate] }, async (request) => {
    const query = getValidatedQuery<{ status?: string; page?: number; limit?: number }>(request);
    const result = await TourService.list(request.user!.sub, query);
    return { success: true, ...result };
  });

  // Get tour suggestions
  fastify.post(
    "/suggest",
    { preHandler: [authenticate, validate(TourSuggestionSchema)], schema: { body: TourSuggestionSchema } },
    async (request) => {
      const body = getValidatedBody<typeof TourSuggestionSchema._type>(request);
      const suggestions = await TourService.getSuggestions(request.user!.sub, body);
      return { success: true, data: suggestions };
    }
  );

  // Get popular routes
  fastify.get("/popular", async (request) => {
    const query = getValidatedQuery<{ provinceId?: string; vehicleType?: string; participantType?: string; limit?: number }>(request);
    const routes = await TourService.getPopularRoutes(query);
    return { success: true, data: routes };
  });

  // Get tour by ID
  fastify.get("/:id", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const tour = await TourService.getById(params.id, request.user!.sub);
    return { success: true, data: tour };
  });

  // Update tour
  fastify.patch(
    "/:id",
    { preHandler: [authenticate, validate(UpdateTourSchema)], schema: { body: UpdateTourSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof UpdateTourSchema._type>(request);
      const tour = await TourService.update(request.user!.sub, params.id, body);
      return { success: true, data: tour };
    }
  );

  // Delete tour
  fastify.delete("/:id", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    await TourService.delete(request.user!.sub, params.id);
    return { success: true, data: { message: "Tur silindi" } };
  });

  // Add destination to tour
  fastify.post(
    "/:id/destinations",
    { preHandler: [authenticate, validate(TourDestinationSchema)], schema: { body: TourDestinationSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof TourDestinationSchema._type>(request);
      const tourDest = await TourService.addDestination(request.user!.sub, params.id, body);
      return { success: true, data: tourDest };
    }
  );

  // Remove destination from tour
  fastify.delete("/:id/destinations/:tourDestinationId", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string; tourDestinationId: string }>(request);
    await TourService.removeDestination(request.user!.sub, params.id, params.tourDestinationId);
    return { success: true, data: { message: "Destinasyon turdan çıkarıldı" } };
  });

  // Reorder destinations in tour
  fastify.patch(
    "/:id/destinations/reorder",
    { preHandler: [authenticate, validate(ReorderTourDestinationsSchema)], schema: { body: ReorderTourDestinationsSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof ReorderTourDestinationsSchema._type>(request);
      const tour = await TourService.reorderDestinations(request.user!.sub, params.id, body);
      return { success: true, data: tour };
    }
  );

  // Calculate route for tour
  fastify.get("/:id/route", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const route = await TourService.calculateRoute(params.id);
    return { success: true, data: route };
  });
}