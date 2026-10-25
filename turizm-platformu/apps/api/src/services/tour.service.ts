// Tour Service - Tour planning, routing, suggestions
import { prisma } from "../utils/prisma";
import { AppError, calculatePagination, getPaginationParams, getSortParams, calculateDistance } from "@turizm/shared";
import { CreateTourInput, UpdateTourInput, TourDestinationInput, ReorderTourDestinationsInput, TourSuggestionInput } from "@turizm/shared";

export class TourService {
  // Create tour
  static async create(userId: string, data: CreateTourInput) {
    const tour = await prisma.userTour.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        participantType: data.participantType,
        vehicleType: data.vehicleType,
        preferences: data.preferences,
        status: "DRAFT",
      },
      include: { destinations: { include: { destination: true } } },
    });

    return tour;
  }

  // Get tour by ID
  static async getById(tourId: string, userId: string) {
    const tour = await prisma.userTour.findUnique({
      where: { id: tourId },
      include: {
        destinations: {
          include: { destination: { include: { type: true, province: true } } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!tour) {
      throw AppError.notFound("TOUR_NOT_FOUND", "Tur bulunamadı");
    }

    if (tour.userId !== userId) {
      throw AppError.forbidden("NOT_OWNER", "Bu turu görme yetkiniz yok");
    }

    return tour;
  }

  // List user's tours
  static async list(userId: string, filters: { status?: string; page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);
    const { sortBy, sortOrder } = getSortParams("createdAt", "desc");

    const where: any = { userId };
    if (filters.status) where.status = filters.status;

    const [tours, total] = await Promise.all([
      prisma.userTour.findMany({
        where,
        include: {
          destinations: {
            include: { destination: { select: { id: true, name: true, latitude: true, longitude: true } } },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userTour.count({ where }),
    ]);

    return { data: tours, meta: calculatePagination(page, limit, total) };
  }

  // Update tour
  static async update(userId: string, tourId: string, data: UpdateTourInput) {
    const tour = await prisma.userTour.findUnique({ where: { id: tourId } });
    if (!tour) throw AppError.notFound("TOUR_NOT_FOUND", "Tur bulunamadı");
    if (tour.userId !== userId) throw AppError.forbidden("NOT_OWNER", "Bu turu düzenleme yetkiniz yok");

    const updateData: any = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    const updated = await prisma.userTour.update({
      where: { id: tourId },
      data: updateData,
      include: { destinations: { include: { destination: true }, orderBy: { orderIndex: "asc" } } },
    });

    return updated;
  }

  // Delete tour
  static async delete(userId: string, tourId: string) {
    const tour = await prisma.userTour.findUnique({ where: { id: tourId } });
    if (!tour) throw AppError.notFound("TOUR_NOT_FOUND", "Tur bulunamadı");
    if (tour.userId !== userId) throw AppError.forbidden("NOT_OWNER", "Bu turu silme yetkiniz yok");

    await prisma.userTour.delete({ where: { id: tourId } });
  }

  // Add destination to tour
  static async addDestination(userId: string, tourId: string, data: TourDestinationInput) {
    const tour = await prisma.userTour.findUnique({ where: { id: tourId } });
    if (!tour) throw AppError.notFound("TOUR_NOT_FOUND", "Tur bulunamadı");
    if (tour.userId !== userId) throw AppError.forbidden("NOT_OWNER", "Bu turu düzenleme yetkiniz yok");

    const destination = await prisma.destination.findUnique({ where: { id: data.destinationId } });
    if (!destination) throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");

    // Get max orderIndex
    const maxOrder = await prisma.tourDestination.aggregate({
      where: { tourId },
      _max: { orderIndex: true },
    });

    const tourDest = await prisma.tourDestination.create({
      data: {
        tourId,
        destinationId: data.destinationId,
        orderIndex: data.orderIndex ?? (maxOrder._max.orderIndex ?? -1) + 1,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
        arrivalTime: data.arrivalTime ? new Date(data.arrivalTime) : null,
        departureTime: data.departureTime ? new Date(data.departureTime) : null,
      },
      include: { destination: { include: { type: true, province: true } } },
    });

    return tourDest;
  }

  // Remove destination from tour
  static async removeDestination(userId: string, tourId: string, tourDestinationId: string) {
    const tourDest = await prisma.tourDestination.findUnique({
      where: { id: tourDestinationId },
      include: { tour: true },
    });
    if (!tourDest) throw AppError.notFound("TOUR_DEST_NOT_FOUND", "Tur destinasyonu bulunamadı");
    if (tourDest.tour.userId !== userId) throw AppError.forbidden("NOT_OWNER", "Bu turu düzenleme yetkiniz yok");

    await prisma.tourDestination.delete({ where: { id: tourDestinationId } });

    // Reorder remaining
    await this.reorderAfterDelete(tourId, tourDest.orderIndex);

    return { success: true };
  }

  // Reorder destinations in tour
  static async reorderDestinations(userId: string, tourId: string, data: ReorderTourDestinationsInput) {
    const tour = await prisma.userTour.findUnique({ where: { id: tourId } });
    if (!tour) throw AppError.notFound("TOUR_NOT_FOUND", "Tur bulunamadı");
    if (tour.userId !== userId) throw AppError.forbidden("NOT_OWNER", "Bu turu düzenleme yetkiniz yok");

    await prisma.$transaction(
      data.destinations.map((d) =>
        prisma.tourDestination.update({
          where: { id: d.id },
          data: { orderIndex: d.orderIndex },
        })
      )
    );

    const updated = await prisma.userTour.findUnique({
      where: { id: tourId },
      include: { destinations: { include: { destination: true }, orderBy: { orderIndex: "asc" } } },
    });

    return updated;
  }

  private static async reorderAfterDelete(tourId: string, deletedIndex: number) {
    const destinations = await prisma.tourDestination.findMany({
      where: { tourId, orderIndex: { gt: deletedIndex } },
      orderBy: { orderIndex: "asc" },
    });

    await prisma.$transaction(
      destinations.map((d, i) =>
        prisma.tourDestination.update({
          where: { id: d.id },
          data: { orderIndex: deletedIndex + i },
        })
      )
    );
  }

  // Calculate tour route (simple nearest neighbor for now)
  static async calculateRoute(tourId: string) {
    const tour = await prisma.userTour.findUnique({
      where: { id: tourId },
      include: { destinations: { include: { destination: true }, orderBy: { orderIndex: "asc" } } },
    });

    if (!tour || tour.destinations.length < 2) {
      return { route: tour?.destinations || [], totalDistance: 0, estimatedDuration: 0 };
    }

    const points = tour.destinations.map((td) => ({
      id: td.destinationId,
      name: td.destination.name,
      lat: Number(td.destination.latitude),
      lon: Number(td.destination.longitude),
    }));

    let totalDistance = 0;
    const route = [];

    for (let i = 0; i < points.length - 1; i++) {
      const dist = calculateDistance(
        { latitude: points[i].lat, longitude: points[i].lon },
        { latitude: points[i + 1].lat, longitude: points[i + 1].lon }
      );
      totalDistance += dist;
      route.push({
        from: points[i],
        to: points[i + 1],
        distance: Math.round(dist * 100) / 100,
      });
    }

    // Estimate duration based on vehicle type (average speeds km/h)
    const speeds: Record<string, number> = {
      CAR: 50,
      BUS: 40,
      PUBLIC_TRANSPORT: 30,
      BICYCLE: 15,
      WALKING: 5,
    };
    const speed = speeds[tour.vehicleType] || 50;
    const driveTime = (totalDistance / speed) * 60; // minutes
    const visitTime = tour.destinations.reduce((sum, d) => sum + (d.durationMinutes || 60), 0);
    const estimatedDuration = Math.round(driveTime + visitTime);

    return { route, totalDistance: Math.round(totalDistance * 100) / 100, estimatedDuration };
  }

  // Get tour suggestions (smart algorithm)
  static async getSuggestions(userId: string, data: TourSuggestionInput) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Find destinations matching preferences in relevant provinces
    const destinations = await prisma.destination.findMany({
      where: {
        isActive: true,
        typeId: { in: data.preferences },
      },
      include: { type: true, province: true },
      take: 100,
    });

    // Filter by location if startLocation provided
    let filtered = destinations;
    if (data.startLocation) {
      filtered = destinations
        .map((d) => ({
          ...d,
          distance: calculateDistance(
            data.startLocation!,
            { latitude: Number(d.latitude), longitude: Number(d.longitude) }
          ),
        }))
        .filter((d) => d.distance <= 200) // Within 200km
        .sort((a, b) => a.distance - b.distance);
    }

    // Group by province for multi-day tours
    const byProvince = new Map<string, typeof filtered>();
    filtered.forEach((d) => {
      const key = d.provinceId;
      if (!byProvince.has(key)) byProvince.set(key, []);
      byProvince.get(key)!.push(d);
    });

    // Generate suggestions
    const suggestions = [];

    for (const [provinceId, dests] of byProvince) {
      if (dests.length < 2) continue;

      // Select top destinations for this province
      const selected = dests.slice(0, Math.min(days * 2, 8));

      // Simple ordering: nearest neighbor from first
      const ordered = this.orderByProximity(selected);

      const totalDistance = ordered.reduce((sum, d, i) => {
        if (i === 0) return sum;
        return sum + calculateDistance(
          { latitude: Number(ordered[i - 1].latitude), longitude: Number(ordered[i - 1].longitude) },
          { latitude: Number(d.latitude), longitude: Number(d.longitude) }
        );
      }, 0);

      const speeds: Record<string, number> = { CAR: 50, BUS: 40, PUBLIC_TRANSPORT: 30, BICYCLE: 15, WALKING: 5 };
      const speed = speeds[data.vehicleType] || 50;
      const driveTime = (totalDistance / speed) * 60;
      const visitTime = ordered.length * 90; // 1.5 hours per destination avg
      const estimatedDuration = Math.round(driveTime + visitTime);

      suggestions.push({
        provinceId,
        provinceName: ordered[0].province.name,
        destinations: ordered.map((d, i) => ({
          destinationId: d.id,
          name: d.name,
          orderIndex: i,
          latitude: Number(d.latitude),
          longitude: Number(d.longitude),
          type: d.type.name,
        })),
        totalDistance: Math.round(totalDistance * 100) / 100,
        estimatedDuration,
        days,
      });
    }

    // Sort by total distance (shorter first)
    suggestions.sort((a, b) => a.totalDistance - b.totalDistance);

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  // Simple nearest neighbor ordering
  private static orderByProximity(destinations: any[]): any[] {
    if (destinations.length <= 1) return destinations;

    const ordered = [destinations[0]];
    const remaining = destinations.slice(1);

    while (remaining.length > 0) {
      const last = ordered[ordered.length - 1];
      let nearestIdx = 0;
      let nearestDist = Infinity;

      remaining.forEach((d, i) => {
        const dist = calculateDistance(
          { latitude: Number(last.latitude), longitude: Number(last.longitude) },
          { latitude: Number(d.latitude), longitude: Number(d.longitude) }
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      });

      ordered.push(remaining[nearestIdx]);
      remaining.splice(nearestIdx, 1);
    }

    return ordered;
  }

  // Get popular routes
  static async getPopularRoutes(filters: { provinceId?: string; vehicleType?: string; participantType?: string; limit?: number } = {}) {
    const where: any = { isActive: true };
    if (filters.provinceId) where.provinceIds = { has: filters.provinceId };
    if (filters.vehicleType) where.vehicleType = filters.vehicleType;
    if (filters.participantType) where.participantType = filters.participantType;

    return prisma.popularRoute.findMany({
      where,
      orderBy: { usageCount: "desc" },
      take: filters.limit || 10,
    });
  }

  // Save a tour as popular route (admin)
  static async saveAsPopularRoute(data: {
    name: string;
    description?: string;
    destinationIds: string[];
    provinceIds: string[];
    vehicleType?: "CAR" | "BUS" | "PUBLIC_TRANSPORT" | "BICYCLE" | "WALKING";
    participantType?: "SOLO" | "FAMILY" | "FRIENDS";
  }) {
    return prisma.popularRoute.create({ data });
  }
}