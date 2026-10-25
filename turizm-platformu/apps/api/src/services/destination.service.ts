// Destination Service - Destinations CRUD, search, filter
import { prisma } from "../utils/prisma";
import { AppError, calculateDistance, calculatePagination, getPaginationParams, getSortParams } from "@turizm/shared";
import { CreateDestinationInput, UpdateDestinationInput, DestinationFilterInput, DestinationTranslationInput } from "@turizm/shared";
import { Prisma } from "@prisma/client";

// Base destination type with all includes
type DestinationWithIncludes = Prisma.DestinationGetPayload<{
  include: { type: true; province: true; district: true; translations: true; _count: { select: { reviews: true; favorites: true } } };
}>;

// Extended destination type with optional distance
interface DestinationWithDistance extends Omit<DestinationWithIncludes, "_count" | "translations"> {
  distance?: number;
  _count?: { reviews: number; favorites: number };
  reviewCount: number;
  favoriteCount: number;
  translations?: never;
}

// For getNearby which has different includes
interface NearbyDestination extends Prisma.DestinationGetPayload<{
  include: { type: true; province: true };
}> {
  distance: number;
}

export class DestinationService {
  // Create destination (admin only)
  static async create(data: CreateDestinationInput, adminId: string) {
    // Check slug uniqueness
    const existing = await prisma.destination.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw AppError.conflict("SLUG_EXISTS", "Bu slug zaten kullanılıyor");
    }

    // Verify type exists
    const type = await prisma.destinationCategory.findUnique({ where: { id: data.typeId } });
    if (!type) {
      throw AppError.notFound("TYPE_NOT_FOUND", "Destinasyon türü bulunamadı");
    }

    // Verify province exists
    const province = await prisma.province.findUnique({ where: { id: data.provinceId } });
    if (!province) {
      throw AppError.notFound("PROVINCE_NOT_FOUND", "İl bulunamadı");
    }

    // Verify district if provided
    if (data.districtId) {
      const district = await prisma.district.findUnique({ where: { id: data.districtId } });
      if (!district || district.provinceId !== data.provinceId) {
        throw AppError.notFound("DISTRICT_NOT_FOUND", "İlçe bulunamadı veya il ile eşleşmiyor");
      }
    }

    const destination = await prisma.destination.create({
      data: {
        ...data,
        openingHours: (data.openingHours as any) || null,
        metadata: (data.metadata as any) || null,
      },
      include: {
        type: true,
        province: true,
        district: true,
        translations: true,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        adminId,
        action: "CREATE",
        entityType: "DESTINATION",
        entityId: destination.id,
        newData: destination,
      },
    });

    return destination;
  }

  // Get destination by ID
  static async getById(id: string, language: string = "tr") {
    const destination = await prisma.destination.findUnique({
      where: { id },
      include: {
        type: true,
        province: true,
        district: true,
        translations: {
          where: { langCode: language },
        },
        _count: {
          select: { reviews: true, favorites: true, clicks: true },
        },
      },
    });

    if (!destination) {
      throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");
    }

    // Apply translation if available
    const translation = destination.translations[0];
    let name = destination.name;
    let description = destination.description;
    let shortDescription = destination.shortDescription;

    if (translation) {
      name = translation.name;
      description = translation.description ?? destination.description;
      shortDescription = translation.shortDescription ?? destination.shortDescription;
    }

    return {
      ...destination,
      name,
      description,
      shortDescription,
      translations: undefined,
      reviewCount: destination._count.reviews,
      favoriteCount: destination._count.favorites,
      clickCount: destination._count.clicks,
      _count: undefined,
    };
  }

  // Get destination by slug
  static async getBySlug(slug: string, language: string = "tr") {
    const destination = await prisma.destination.findUnique({
      where: { slug },
      include: {
        type: true,
        province: true,
        district: true,
        translations: {
          where: { langCode: language },
        },
        _count: {
          select: { reviews: true, favorites: true, clicks: true },
        },
      },
    });

    if (!destination) {
      throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");
    }

    const translation = destination.translations[0];
    let name = destination.name;
    let description = destination.description;
    let shortDescription = destination.shortDescription;

    if (translation) {
      name = translation.name;
      description = translation.description ?? destination.description;
      shortDescription = translation.shortDescription ?? destination.shortDescription;
    }

    return {
      ...destination,
      name,
      description,
      shortDescription,
      translations: undefined,
      reviewCount: destination._count.reviews,
      favoriteCount: destination._count.favorites,
      clickCount: destination._count.clicks,
      _count: undefined,
    };
  }

  // List destinations with filters
  static async list(filters: DestinationFilterInput) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);
    const { sortBy, sortOrder } = getSortParams(filters.sortBy, filters.sortOrder, [
      "name", "averageRating", "reviewCount", "viewCount", "createdAt"
    ]);

    // Build where clause
    const where: any = { isActive: filters.isActive ?? true };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { shortDescription: { contains: filters.search, mode: "insensitive" } },
        { province: { name: { contains: filters.search, mode: "insensitive" } } },
        { type: { name: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    if (filters.provinceId) where.provinceId = filters.provinceId;
    if (filters.districtId) where.districtId = filters.districtId;
    if (filters.typeId) where.typeId = filters.typeId;
    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;

    // Location-based filtering (PostGIS would be better, but using raw for now)
    let locationFilter = "";
    const params: any[] = [];

    if (filters.lat !== undefined && filters.lon !== undefined) {
      // Use Haversine formula in raw query for distance filtering
      // For now, we'll use bounding box approximation
      const radius = filters.radius || 10; // km
      const latDelta = radius / 111.32;
      const lonDelta = radius / (111.32 * Math.cos((filters.lat * Math.PI) / 180));

      where.latitude = { gte: filters.lat - latDelta, lte: filters.lat + latDelta };
      where.longitude = { gte: filters.lon - lonDelta, lte: filters.lon + lonDelta };
    }

    // Execute queries
    const [destinations, total] = await Promise.all([
      prisma.destination.findMany({
        where,
        include: {
          type: true,
          province: true,
          district: true,
          translations: { where: { langCode: filters.language } },
          _count: { select: { reviews: true, favorites: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.destination.count({ where }),
    ]);

    // Apply translations
    const data: DestinationWithDistance[] = destinations.map((d) => {
      const translation = d.translations[0];
      let name = d.name;
      let description = d.description;
      let shortDescription = d.shortDescription;

      if (translation) {
        name = translation.name;
        description = translation.description ?? d.description;
        shortDescription = translation.shortDescription ?? d.shortDescription;
      }

      return {
        ...d,
        name,
        description,
        shortDescription,
        translations: undefined,
        reviewCount: d._count.reviews,
        favoriteCount: d._count.favorites,
        _count: { reviews: d._count.reviews, favorites: d._count.favorites },
      };
    });

    // Calculate distance if location provided
    if (filters.lat !== undefined && filters.lon !== undefined) {
      data.forEach((d) => {
        d.distance = calculateDistance(
          { latitude: filters.lat!, longitude: filters.lon! },
          { latitude: Number(d.latitude), longitude: Number(d.longitude) }
        );
      });
      // Sort by distance if requested
      if (filters.sortBy === "distance") {
        data.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }
    }

    return {
      data,
      meta: calculatePagination(page, limit, total),
    };
  }

  // Update destination (admin only)
  static async update(id: string, data: UpdateDestinationInput, adminId: string) {
    const existing = await prisma.destination.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");
    }

    // Verify type if changing
    if (data.typeId) {
      const type = await prisma.destinationCategory.findUnique({ where: { id: data.typeId } });
      if (!type) throw AppError.notFound("TYPE_NOT_FOUND", "Destinasyon türü bulunamadı");
    }

    // Verify province if changing
    if (data.provinceId) {
      const province = await prisma.province.findUnique({ where: { id: data.provinceId } });
      if (!province) throw AppError.notFound("PROVINCE_NOT_FOUND", "İl bulunamadı");
    }

    // Verify district if changing
    if (data.districtId) {
      const district = await prisma.district.findUnique({ where: { id: data.districtId } });
      if (!district || (data.provinceId && district.provinceId !== data.provinceId) || (!data.provinceId && district.provinceId !== existing.provinceId)) {
        throw AppError.notFound("DISTRICT_NOT_FOUND", "İlçe bulunamadı veya il ile eşleşmiyor");
      }
    }

    const destination = await prisma.destination.update({
      where: { id },
      data: {
        ...data,
        openingHours: (data.openingHours as any) || null,
        metadata: (data.metadata as any) || null,
      },
      include: {
        type: true,
        province: true,
        district: true,
        translations: true,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        adminId,
        action: "UPDATE",
        entityType: "DESTINATION",
        entityId: id,
        oldData: existing,
        newData: destination,
      },
    });

    return destination;
  }

  // Delete destination (admin only)
  static async delete(id: string, adminId: string): Promise<void> {
    const existing = await prisma.destination.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");
    }

    await prisma.destination.delete({ where: { id } });

    // Log audit
    await prisma.auditLog.create({
      data: {
        adminId,
        action: "DELETE",
        entityType: "DESTINATION",
        entityId: id,
        oldData: existing,
      },
    });
  }

  // Increment view count
  static async incrementViewCount(id: string): Promise<void> {
    await prisma.destination.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  // Increment click count
  static async incrementClickCount(id: string, userId?: string, ip?: string, userAgent?: string, referrer?: string): Promise<void> {
    await prisma.$transaction([
      prisma.destination.update({
        where: { id },
        data: { clickCount: { increment: 1 } },
      }),
      prisma.click.create({
        data: {
          destinationId: id,
          userId,
          ipAddress: ip,
          userAgent,
          referrer,
        },
      }),
    ]);
  }

  // Add/update translation
  static async upsertTranslation(destinationId: string, data: DestinationTranslationInput) {
    const destination = await prisma.destination.findUnique({ where: { id: destinationId } });
    if (!destination) {
      throw AppError.notFound("DESTINATION_NOT_FOUND", "Destinasyon bulunamadı");
    }

    return prisma.destinationTranslation.upsert({
      where: {
        destinationId_langCode: { destinationId, langCode: data.langCode },
      },
      update: data,
      create: { destinationId, ...data },
    });
  }

  // Get destination types
  static async getTypes() {
    return prisma.destinationCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  // Get provinces
  static async getProvinces() {
    return prisma.province.findMany({
      orderBy: { name: "asc" },
      include: { districts: { orderBy: { name: "asc" } } },
    });
  }

  // Get districts by province
  static async getDistricts(provinceId: string) {
    return prisma.district.findMany({
      where: { provinceId },
      orderBy: { name: "asc" },
    });
  }

  // Get featured destinations
  static async getFeatured(limit: number = 10, language: string = "tr") {
    const destinations = await prisma.destination.findMany({
      where: { isActive: true, isFeatured: true },
      include: {
        type: true,
        province: true,
        translations: { where: { langCode: language } },
      },
      orderBy: { viewCount: "desc" },
      take: limit,
    });

    return destinations.map((d) => {
      const translation = d.translations[0];
      return {
        ...d,
        name: translation?.name ?? d.name,
        description: translation?.description ?? d.description,
        shortDescription: translation?.shortDescription ?? d.shortDescription,
        translations: undefined,
      };
    });
  }

  // Get nearby destinations
  static async getNearby(latitude: number, longitude: number, radiusKm: number = 10, limit: number = 20): Promise<NearbyDestination[]> {
    const latDelta = radiusKm / 111.32;
    const lonDelta = radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180));

    const destinations = await prisma.destination.findMany({
      where: {
        isActive: true,
        latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
        longitude: { gte: longitude - lonDelta, lte: longitude + lonDelta },
      },
      include: {
        type: true,
        province: true,
      },
      take: limit * 2, // Get more to filter by actual distance
    });

    // Calculate actual distances and filter
    const withDistance: NearbyDestination[] = destinations
      .map((d) => ({
        ...d,
        distance: calculateDistance(
          { latitude, longitude },
          { latitude: Number(d.latitude), longitude: Number(d.longitude) }
        ),
      }))
      .filter((d) => d.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return withDistance;
  }
}