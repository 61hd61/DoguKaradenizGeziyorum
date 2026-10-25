// Global Error Handler
import { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { AppError, isAppError } from "@turizm/shared";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export async function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  // Log error
  request.log.error({ err: error, url: request.url, method: request.method }, "Request error");

  // AppError (our custom errors)
  if (isAppError(error)) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) errors[path] = [];
      errors[path].push(issue.message);
    }
    return reply.status(422).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Doğrulama hatası",
        details: { errors },
      },
    });
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[])?.join(", ") || "alan";
      return reply.status(409).send({
        success: false,
        error: { code: "UNIQUE_CONSTRAINT", message: `${target} zaten kullanılıyor`, details: { fields: target } },
      });
    }

    // Foreign key constraint violation
    if (error.code === "P2003") {
      return reply.status(400).send({
        success: false,
        error: { code: "FOREIGN_KEY_CONSTRAINT", message: "İlişkili kayıt bulunamadı", details: error.meta },
      });
    }

    // Record not found
    if (error.code === "P2025") {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Kayıt bulunamadı" },
      });
    }
  }

  // JWT errors
  if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
    return reply.status(401).send({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Geçersiz veya süresi dolmuş token" },
    });
  }

  // Multer/File upload errors
  if (error.name === "MulterError") {
    return reply.status(400).send({
      success: false,
      error: { code: "UPLOAD_ERROR", message: error.message },
    });
  }

  // Default: Internal server error
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Sunucu hatası oluştu" : error.message;

  return reply.status(statusCode).send({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message,
      details: process.env.NODE_ENV === "development" ? { stack: error.stack } : undefined,
    },
  });
}

// 404 handler
export async function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({
    success: false,
    error: { code: "NOT_FOUND", message: `Route ${request.method} ${request.url} bulunamadı` },
  });
}