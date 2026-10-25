// Main Application Entry Point
import Fastify, { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRoutes } from "./routes/auth";
import { destinationRoutes } from "./routes/destinations";
import { reviewRoutes } from "./routes/reviews";
import { tourRoutes } from "./routes/tours";
import { favoriteRoutes } from "./routes/favorites";
import { blogRoutes } from "./routes/blog";
import { adminRoutes } from "./routes/admin";
import { prisma } from "./utils/prisma";

const fastify = Fastify({
  logger: config.nodeEnv === "development" ? { level: config.logLevel, transport: { target: "pino-pretty" } } : { level: config.logLevel },
  ajv: { customOptions: { removeAdditional: "all" } },
}).withTypeProvider<ZodTypeProvider>();

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(fastifyCors, {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Cookie parsing
  await fastify.register(fastifyCookie, {
    secret: config.jwt.secret,
    parseOptions: {},
  });

  // JWT
  await fastify.register(fastifyJwt as any, {
    secret: config.jwt.secret,
    sign: { issuer: config.jwt.issuer, audience: config.jwt.audience },
    verify: { issuer: config.jwt.issuer, audience: config.jwt.audience },
    cookie: { cookieName: "refreshToken", signed: false },
  });

  // Rate limiting
  await fastify.register(fastifyRateLimit, {
    global: false, // We'll apply per route
  });

  // Swagger/OpenAPI
  if (config.swagger.enabled) {
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: "Turizm Platformu API",
          description: "Karadeniz turizm destinasyonları platformu API dokümantasyonu",
          version: "1.0.0",
        },
        servers: [{ url: `http://${config.host}:${config.port}${config.apiPrefix}`, description: "Development server" }],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            cookieAuth: { type: "apiKey", in: "cookie", name: "refreshToken" },
          },
        },
        security: [{ bearerAuth: [], cookieAuth: [] }],
      },
    });

    await fastify.register(fastifySwaggerUi, {
      routePrefix: config.swagger.path,
      uiConfig: { docExpansion: "list", deepLinking: true },
    });
  }
}

// Register routes
async function registerRoutes() {
  // Health check
  fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // API routes with prefix
  await fastify.register(async (app) => {
    app.register(authRoutes, { prefix: "/auth" });
    app.register(destinationRoutes, { prefix: "/destinations" });
    app.register(reviewRoutes, { prefix: "/reviews" });
    app.register(tourRoutes, { prefix: "/tours" });
    app.register(favoriteRoutes, { prefix: "/favorites" });
    app.register(blogRoutes, { prefix: "/blog" });
    app.register(adminRoutes, { prefix: "/admin" });
  }, { prefix: config.apiPrefix });

  // 404 handler
  fastify.setNotFoundHandler(notFoundHandler);

  // Global error handler
  fastify.setErrorHandler(errorHandler);
}

// Graceful shutdown
async function shutdown() {
  fastify.log.info("Shutting down...");
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start server
async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`🚀 Server running at http://${config.host}:${config.port}`);
    fastify.log.info(`📚 API docs at http://${config.host}:${config.port}${config.swagger.path}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

export { fastify };