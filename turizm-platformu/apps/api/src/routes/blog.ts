// Blog/Social Routes - Posts, comments, follows, notifications
import { FastifyInstance } from "fastify";
import { BlogService } from "../services/blog.service";
import { validate, getValidatedBody, getValidatedQuery, getValidatedParams } from "../middleware/validation";
import { authenticate, optionalAuth } from "../middleware/auth";
import { CreatePostSchema, UpdatePostSchema, CreateCommentSchema, PostFilterSchema } from "@turizm/shared";

export async function blogRoutes(fastify: FastifyInstance) {
  // ============================================
  // POSTS
  // ============================================

  // Create post
  fastify.post(
    "/posts",
    { preHandler: [authenticate, validate(CreatePostSchema)], schema: { body: CreatePostSchema } },
    async (request) => {
      const body = getValidatedBody<typeof CreatePostSchema._type>(request);
      const post = await BlogService.createPost(request.user!.sub, body);
      return { success: true, data: post };
    }
  );

  // List posts (feed)
  fastify.get("/posts", { preHandler: [optionalAuth], schema: { querystring: PostFilterSchema } }, async (request) => {
    const query = getValidatedQuery<typeof PostFilterSchema._type>(request);
    const result = await BlogService.listPosts(query, request.user?.sub);
    return { success: true, ...result };
  });

  // Get user's posts
  fastify.get("/users/:userId/posts", { preHandler: [optionalAuth] }, async (request) => {
    const params = getValidatedParams<{ userId: string }>(request);
    const query = getValidatedQuery<{ page?: number; limit?: number; sortBy?: string; sortOrder?: string }>(request);
    const result = await BlogService.listPosts({ 
      userId: params.userId, 
      page: query.page ?? 1, 
      limit: query.limit ?? 10,
      sortBy: (query.sortBy as any) || "publishedAt",
      sortOrder: (query.sortOrder as any) || "desc",
    }, request.user?.sub);
    return { success: true, ...result };
  });

  // Get post by ID
  fastify.get("/posts/:id", { preHandler: [optionalAuth] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const post = await BlogService.getPostById(params.id, request.user?.sub);
    return { success: true, data: post };
  });

  // Update post
  fastify.patch(
    "/posts/:id",
    { preHandler: [authenticate, validate(UpdatePostSchema)], schema: { body: UpdatePostSchema, params: { type: "object", properties: { id: { type: "string", format: "cuid" } }, required: ["id"] } } },
    async (request) => {
      const params = getValidatedParams<{ id: string }>(request);
      const body = getValidatedBody<typeof UpdatePostSchema._type>(request);
      const post = await BlogService.updatePost(request.user!.sub, params.id, body);
      return { success: true, data: post };
    }
  );

  // Delete post
  fastify.delete("/posts/:id", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const isAdmin = request.user!.role === "ADMIN" || request.user!.role === "SUPER_ADMIN";
    await BlogService.deletePost(request.user!.sub, params.id, isAdmin);
    return { success: true, data: { message: "Yazı silindi" } };
  });

  // Like/unlike post
  fastify.post("/posts/:id/like", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    const result = await BlogService.togglePostLike(request.user!.sub, params.id);
    return { success: true, data: result };
  });

  // ============================================
  // COMMENTS
  // ============================================

  // Create comment
  fastify.post(
    "/posts/:postId/comments",
    { preHandler: [authenticate, validate(CreateCommentSchema)], schema: { body: CreateCommentSchema, params: { type: "object", properties: { postId: { type: "string", format: "cuid" } }, required: ["postId"] } } },
    async (request) => {
      const params = getValidatedParams<{ postId: string }>(request);
      const body = getValidatedBody<typeof CreateCommentSchema._type>(request);
      const comment = await BlogService.createComment(request.user!.sub, { ...body, postId: params.postId });
      return { success: true, data: comment };
    }
  );

  // Get comments for post
  fastify.get("/posts/:postId/comments", async (request) => {
    const params = getValidatedParams<{ postId: string }>(request);
    const query = getValidatedQuery<{ page?: number; limit?: number }>(request);
    const result = await BlogService.getComments(params.postId, query);
    return { success: true, ...result };
  });

  // ============================================
  // FOLLOWS
  // ============================================

  // Follow user
  fastify.post("/users/:userId/follow", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ userId: string }>(request);
    if (request.user!.sub === params.userId) {
      return { success: false, error: { code: "SELF_FOLLOW", message: "Kendinizi takip edemezsiniz" } };
    }
    const result = await BlogService.follow(request.user!.sub, params.userId);
    return { success: true, data: result };
  });

  // Unfollow user
  fastify.delete("/users/:userId/follow", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ userId: string }>(request);
    const result = await BlogService.unfollow(request.user!.sub, params.userId);
    return { success: true, data: result };
  });

  // Check if following
  fastify.get("/users/:userId/follow", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ userId: string }>(request);
    const following = await BlogService.isFollowing(request.user!.sub, params.userId);
    return { success: true, data: { following } };
  });

  // Get followers
  fastify.get("/users/:userId/followers", async (request) => {
    const params = getValidatedParams<{ userId: string }>(request);
    const query = getValidatedQuery<{ page?: number; limit?: number }>(request);
    const result = await BlogService.getFollowers(params.userId, query);
    return { success: true, ...result };
  });

  // Get following
  fastify.get("/users/:userId/following", async (request) => {
    const params = getValidatedParams<{ userId: string }>(request);
    const query = getValidatedQuery<{ page?: number; limit?: number }>(request);
    const result = await BlogService.getFollowing(params.userId, query);
    return { success: true, ...result };
  });

  // ============================================
  // NOTIFICATIONS
  // ============================================

  // Get notifications
  fastify.get("/notifications", { preHandler: [authenticate] }, async (request) => {
    const query = getValidatedQuery<{ unreadOnly?: boolean; page?: number; limit?: number }>(request);
    const result = await BlogService.getNotifications(request.user!.sub, query);
    return { success: true, ...result };
  });

  // Mark notification as read
  fastify.patch("/notifications/:id/read", { preHandler: [authenticate] }, async (request) => {
    const params = getValidatedParams<{ id: string }>(request);
    await BlogService.markAsRead(request.user!.sub, params.id);
    return { success: true, data: { message: "Okundu olarak işaretlendi" } };
  });

  // Mark all notifications as read
  fastify.patch("/notifications/read-all", { preHandler: [authenticate] }, async (request) => {
    await BlogService.markAllAsRead(request.user!.sub);
    return { success: true, data: { message: "Tüm bildirimler okundu olarak işaretlendi" } };
  });

  // Get unread count
  fastify.get("/notifications/unread-count", { preHandler: [authenticate] }, async (request) => {
    const result = await BlogService.getNotifications(request.user!.sub, { unreadOnly: true, limit: 1 });
    return { success: true, data: { unreadCount: result.unreadCount } };
  });
}