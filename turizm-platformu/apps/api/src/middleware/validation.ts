// Validation Middleware - Zod schema validation
import { FastifyRequest, FastifyReply } from "fastify";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "@turizm/shared";

// Type helper for validated request data
export type ValidatedRequest<T extends FastifyRequest, Source extends "body" | "query" | "params" | "headers"> = T & {
  [K in Source]: K extends "body" ? T["body"] : K extends "query" ? T["query"] : K extends "params" ? T["params"] : T["headers"];
};

export function validate(schema: ZodSchema, source: "body" | "query" | "params" | "headers" = "body") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request[source];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of result.error.issues) {
          const path = issue.path.join(".");
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        throw AppError.validation(errors);
      }

      // Replace with parsed/transformed data
      (request as any)[source] = result.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join(".");
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        throw AppError.validation(errors);
      }
      throw error;
    }
  };
}

// Validate multiple sources
export function validateAll(schemas: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema; headers?: ZodSchema }) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const errors: Record<string, string[]> = {};

    for (const [source, schema] of Object.entries(schemas)) {
      if (!schema) continue;
      try {
        const data = request[source as keyof FastifyRequest];
        const result = schema.safeParse(data);
        if (!result.success) {
          for (const issue of result.error.issues) {
            const path = `${source}.${issue.path.join(".")}`;
            if (!errors[path]) errors[path] = [];
            errors[path].push(issue.message);
          }
        } else {
          (request as any)[source] = result.data;
        }
      } catch (error) {
        if (error instanceof ZodError) {
          for (const issue of error.issues) {
            const path = `${source}.${issue.path.join(".")}`;
            if (!errors[path]) errors[path] = [];
            errors[path].push(issue.message);
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw AppError.validation(errors);
    }
  };
}

// Helper to get typed request data after validation
export function getValidatedBody<T>(request: FastifyRequest): T {
  return request.body as T;
}

export function getValidatedQuery<T>(request: FastifyRequest): T {
  return request.query as T;
}

export function getValidatedParams<T>(request: FastifyRequest): T {
  return request.params as T;
}