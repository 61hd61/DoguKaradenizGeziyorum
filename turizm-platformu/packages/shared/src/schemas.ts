// Shared Zod Schemas - Validation for both frontend & backend
import { z } from "zod";

// ============================================
// ENUMS (matching Prisma)
// ============================================

export const UserRoleSchema = z.enum(["USER", "ADMIN", "SUPER_ADMIN"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const TourParticipantTypeSchema = z.enum(["SOLO", "FAMILY", "FRIENDS"]);
export type TourParticipantType = z.infer<typeof TourParticipantTypeSchema>;

export const TourVehicleTypeSchema = z.enum(["CAR", "BUS", "PUBLIC_TRANSPORT", "BICYCLE", "WALKING"]);
export type TourVehicleType = z.infer<typeof TourVehicleTypeSchema>;

export const DestinationTypeEnumSchema = z.enum([
  "CAMI", "TURBE", "KILISE", "SAPEL", "KALE", "TARIHI_BINA",
  "HAN", "HAMAM", "SELALE", "KOPRU", "SIVIL_MIMARI", "MAGARA",
  "MILLI_PARK", "MUZE", "SENLIKLER", "GOL", "KANYON", "YERLESim",
  "CEshME", "DEGIRMEN", "KOY", "ANTIK", "ANIT", "KULTUR_EVI",
  "MEDRESE", "KAYMAKAMLIK", "OKUL", "BAHCE_KAPISI", "KAYA_MEZARI",
  "KAYAUSTU", "KAYALIK", "TOPRAK_ALTI", "YAMAC", "ARKEOLOJIK"
]);
export type DestinationTypeEnum = z.infer<typeof DestinationTypeEnumSchema>;

export const ReviewCategorySchema = z.enum(["FAMILY", "ADULT", "SOLO", "FRIENDS"]);
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;

export const PostVisibilitySchema = z.enum(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"]);
export type PostVisibility = z.infer<typeof PostVisibilitySchema>;

export const NotificationTypeSchema = z.enum([
  "NEW_FOLLOWER", "NEW_POST", "NEW_COMMENT", "REVIEW_LIKE", "TOUR_INVITE", "SYSTEM"
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const LanguageCodeSchema = z.enum(["tr", "en", "ru", "ar", "de"]);
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

export const SupportedLanguages = ["tr", "en", "ru", "ar", "de"] as const;

// ============================================
// AUTH SCHEMAS
// ============================================

export const RegisterSchema = z.object({
  firstName: z.string().min(1, "Ad zorunludur").max(100),
  lastName: z.string().min(1, "Soyad zorunludur").max(100),
  username: z.string()
    .min(3, "Kullanıcı adı en az 3 karakter olmalıdır")
    .max(50, "Kullanıcı adı en fazla 50 karakter olmalıdır")
    .regex(/^@[a-zA-Z0-9_]+$/, "Kullanıcı adı @ ile başlamalı ve sadece harf, rakam, alt çizgi içermelidir"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string()
    .min(8, "Şifre en az 8 karakter olmalıdır")
    .max(128)
    .regex(/[A-Z]/, "Şifre en az 1 büyük harf içermelidir")
    .regex(/[a-z]/, "Şifre en az 1 küçük harf içermelidir")
    .regex(/[0-9]/, "Şifre en az 1 rakam içermelidir")
    .regex(/[^A-Za-z0-9]/, "Şifre en az 1 özel karakter içermelidir"),
  confirmPassword: z.string(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
});

export const LoginSchema = z.object({
  identifier: z.string().min(1, "E-posta veya kullanıcı adı zorunludur"), // email or @username
  password: z.string().min(1, "Şifre zorunludur"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Token zorunludur"),
  password: z.string()
    .min(8, "Şifre en az 8 karakter olmalıdır")
    .max(128)
    .regex(/[A-Z]/, "Şifre en az 1 büyük harf içermelidir")
    .regex(/[a-z]/, "Şifre en az 1 küçük harf içermelidir")
    .regex(/[0-9]/, "Şifre en az 1 rakam içermelidir")
    .regex(/[^A-Za-z0-9]/, "Şifre en az 1 özel karakter içermelidir"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, "Doğrulama kodu zorunludur"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token zorunludur"),
});

// ============================================
// USER SCHEMAS
// ============================================

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  preferences: z.record(z.unknown()).optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre zorunludur"),
  newPassword: z.string()
    .min(8, "Şifre en az 8 karakter olmalıdır")
    .max(128)
    .regex(/[A-Z]/, "Şifre en az 1 büyük harf içermelidir")
    .regex(/[a-z]/, "Şifre en az 1 küçük harf içermelidir")
    .regex(/[0-9]/, "Şifre en az 1 rakam içermelidir")
    .regex(/[^A-Za-z0-9]/, "Şifre en az 1 özel karakter içermelidir"),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Yeni şifreler eşleşmiyor",
  path: ["confirmNewPassword"],
});

// ============================================
// DESTINATION SCHEMAS
// ============================================

export const CreateDestinationSchema = z.object({
  name: z.string().min(1, "İsim zorunludur").max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug sadece küçük harf, rakam ve tire içerebilir"),
  description: z.string().optional(),
  shortDescription: z.string().max(500).optional(),
  typeId: z.string().cuid("Geçersiz tür ID"),
  provinceId: z.string().cuid("Geçersiz il ID"),
  districtId: z.string().cuid().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  website: z.string().url().optional().or(z.literal("")),
  openingHours: z.record(z.string()).optional(),
  images: z.array(z.string().url()).default([]),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const UpdateDestinationSchema = CreateDestinationSchema.partial().omit({ slug: true });

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

const QueryIdSchema = z.preprocess(
  emptyToUndefined,
  z.string().min(1).max(64).optional()
);

const QueryBooleanSchema = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) return undefined;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return value;
}, z.boolean().optional());

export const DestinationFilterSchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  provinceId: QueryIdSchema,
  districtId: QueryIdSchema,
  typeId: QueryIdSchema,
  language: LanguageCodeSchema.default("tr"),
  lat: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90).optional()),
  lon: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180).optional()),
  radius: z.preprocess(emptyToUndefined, z.coerce.number().min(1).max(100).optional()).default(10),
  isFeatured: QueryBooleanSchema,
  isActive: QueryBooleanSchema.default(true),
  sortBy: z.enum(["name", "rating", "reviewCount", "viewCount", "distance", "createdAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(2000).default(20),
});

export const DestinationTranslationSchema = z.object({
  langCode: LanguageCodeSchema,
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  shortDescription: z.string().max(500).optional(),
});

// ============================================
// REVIEW SCHEMAS
// ============================================

export const CreateReviewSchema = z.object({
  destinationId: z.string().cuid("Geçersiz destinasyon ID"),
  category: ReviewCategorySchema,
  content: z.string().min(10, "Yorum en az 10 karakter olmalıdır").max(5000),
  rating: z.number().int().min(1).max(5),
});

export const UpdateReviewSchema = z.object({
  content: z.string().min(10).max(5000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const ReviewFilterSchema = z.object({
  destinationId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  category: ReviewCategorySchema.optional(),
  isApproved: z.boolean().optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  maxRating: z.number().int().min(1).max(5).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
  sortBy: z.enum(["createdAt", "rating", "helpful"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================
// TOUR SCHEMAS
// ============================================

const CreateTourBaseSchema = z.object({
  name: z.string().min(1, "Tur adı zorunludur").max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  participantType: TourParticipantTypeSchema,
  vehicleType: TourVehicleTypeSchema,
  preferences: z.array(z.string().cuid()).default([]),
});

export const CreateTourSchema = CreateTourBaseSchema.refine(
  (data) => new Date(data.startDate) < new Date(data.endDate),
  { message: "Başlangıç tarihi bitiş tarihinden önce olmalıdır", path: ["startDate"] }
);

export const UpdateTourSchema = CreateTourBaseSchema.partial();

export const TourDestinationSchema = z.object({
  destinationId: z.string().cuid(),
  orderIndex: z.number().int().min(0),
  durationMinutes: z.number().int().min(1).optional(),
  notes: z.string().max(1000).optional(),
  arrivalTime: z.string().datetime({ offset: true }).optional(),
  departureTime: z.string().datetime({ offset: true }).optional(),
});

export const ReorderTourDestinationsSchema = z.object({
  destinations: z.array(z.object({
    id: z.string().cuid(),
    orderIndex: z.number().int().min(0),
  })),
});

export const TourSuggestionSchema = z.object({
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  participantType: TourParticipantTypeSchema,
  vehicleType: TourVehicleTypeSchema,
  preferences: z.array(z.string().cuid()).min(1, "En az bir tercih seçiniz"),
  startLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

// ============================================
// BLOG / SOCIAL SCHEMAS
// ============================================

export const CreatePostSchema = z.object({
  title: z.string().min(1, "Başlık zorunludur").max(200),
  content: z.string().min(10, "İçerik en az 10 karakter olmalıdır"),
  images: z.array(z.string().url()).default([]),
  visibility: PostVisibilitySchema.default("PUBLIC"),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const UpdatePostSchema = CreatePostSchema.partial();

export const CreateCommentSchema = z.object({
  postId: z.string().cuid(),
  content: z.string().min(1, "Yorum boş olamaz").max(2000),
  parentId: z.string().cuid().optional(),
});

export const PostFilterSchema = z.object({
  userId: z.string().cuid().optional(),
  visibility: PostVisibilitySchema.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
  sortBy: z.enum(["publishedAt", "likeCount", "commentCount", "viewCount"]).default("publishedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================
// ADMIN SCHEMAS
// ============================================

export const AdminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).default("ADMIN"),
  permissions: z.array(z.string()).default([]),
});

export const AdminUpdateDestinationSchema = z.object({
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  typeId: z.string().cuid().optional(),
  provinceId: z.string().cuid().optional(),
});

export const AdminReviewActionSchema = z.object({
  reviewId: z.string().cuid(),
  action: z.enum(["APPROVE", "REJECT"]),
});

// ============================================
// PAGINATION & RESPONSE
// ============================================

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      page: z.number().int().min(1),
      limit: z.number().int().min(1),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    }).optional(),
    meta: z.record(z.unknown()).optional(),
  });

// ============================================
// TYPE EXPORTS
// ============================================

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export type CreateDestinationInput = z.infer<typeof CreateDestinationSchema>;
export type UpdateDestinationInput = z.infer<typeof UpdateDestinationSchema>;
export type DestinationFilterInput = z.infer<typeof DestinationFilterSchema>;
export type DestinationTranslationInput = z.infer<typeof DestinationTranslationSchema>;

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
export type ReviewFilterInput = z.infer<typeof ReviewFilterSchema>;

export type CreateTourInput = z.infer<typeof CreateTourSchema>;
export type UpdateTourInput = z.infer<typeof UpdateTourSchema>;
export type TourDestinationInput = z.infer<typeof TourDestinationSchema>;
export type ReorderTourDestinationsInput = z.infer<typeof ReorderTourDestinationsSchema>;
export type TourSuggestionInput = z.infer<typeof TourSuggestionSchema>;

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type PostFilterInput = z.infer<typeof PostFilterSchema>;

export type PaginationInput = z.infer<typeof PaginationSchema>;