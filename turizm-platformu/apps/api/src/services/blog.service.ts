// Blog/Social Service - Posts, comments, follows, notifications
import { prisma } from "../utils/prisma";
import { AppError, calculatePagination, getPaginationParams, getSortParams } from "@turizm/shared";
import { CreatePostInput, UpdatePostInput, CreateCommentInput, PostFilterInput } from "@turizm/shared";

export class BlogService {
  // ============================================
  // POSTS
  // ============================================

  static async createPost(userId: string, data: CreatePostInput) {
    const post = await prisma.post.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        images: data.images,
        visibility: data.visibility,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        publishedAt: data.visibility === "PUBLIC" ? new Date() : null,
      },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Notify followers
    await this.notifyFollowers(userId, "NEW_POST", "Yeni yazı", post.title, post.id, "POST");

    return post;
  }

  static async getPostById(postId: string, currentUserId?: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (!post) throw AppError.notFound("POST_NOT_FOUND", "Yazı bulunamadı");

    // Check visibility
    if (post.visibility === "PRIVATE" && post.userId !== currentUserId) {
      throw AppError.forbidden("PRIVATE_POST", "Bu yazı özel");
    }
    if (post.visibility === "FOLLOWERS_ONLY" && post.userId !== currentUserId) {
      const isFollowing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: currentUserId!, followingId: post.userId } },
      });
      if (!isFollowing) throw AppError.forbidden("FOLLOWERS_ONLY", "Bu yazı sadece takipçiler için");
    }

    let isLiked = false;
    if (currentUserId) {
      const like = await prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId: currentUserId } },
      });
      isLiked = !!like;
    }

    // Increment view count
    await prisma.post.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } });

    return { ...post, isLiked };
  }

  static async updatePost(userId: string, postId: string, data: UpdatePostInput) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw AppError.notFound("POST_NOT_FOUND", "Yazı bulunamadı");
    if (post.userId !== userId) throw AppError.forbidden("NOT_OWNER", "Bu yazıyı düzenleme yetkiniz yok");

    const updateData: any = { ...data };
    if (data.visibility === "PUBLIC" && post.visibility !== "PUBLIC") {
      updateData.publishedAt = new Date();
    }

    return prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: { user: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } } },
    });
  }

  static async deletePost(userId: string, postId: string, isAdmin: boolean = false) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw AppError.notFound("POST_NOT_FOUND", "Yazı bulunamadı");
    if (post.userId !== userId && !isAdmin) throw AppError.forbidden("NOT_OWNER", "Bu yazıyı silme yetkiniz yok");

    await prisma.post.delete({ where: { id: postId } });
  }

  static async listPosts(filters: PostFilterInput, currentUserId?: string) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);
    const { sortBy, sortOrder } = getSortParams(filters.sortBy, filters.sortOrder, ["publishedAt", "likeCount", "commentCount", "viewCount"]);

    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.visibility) where.visibility = filters.visibility;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { content: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // If not admin, filter by visibility
    if (!filters.userId || filters.userId !== currentUserId) {
      where.OR = [
        { visibility: "PUBLIC" },
        ...(currentUserId ? [{ visibility: "FOLLOWERS_ONLY", user: { followers: { some: { followerId: currentUserId } } } }] : []),
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    // Add isLiked for current user
    let postsWithLikes = posts;
    if (currentUserId) {
      const likedPostIds = await prisma.postLike.findMany({
        where: { userId: currentUserId, postId: { in: posts.map((p) => p.id) } },
        select: { postId: true },
      });
      const likedSet = new Set(likedPostIds.map((l) => l.postId));
      postsWithLikes = posts.map((p) => ({ ...p, isLiked: likedSet.has(p.id) }));
    }

    return { data: postsWithLikes, meta: calculatePagination(page, limit, total) };
  }

  // ============================================
  // POST LIKES
  // ============================================

  static async togglePostLike(userId: string, postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw AppError.notFound("POST_NOT_FOUND", "Yazı bulunamadı");

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      await prisma.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
      return { liked: false, likeCount: post.likeCount - 1 };
    } else {
      await prisma.postLike.create({ data: { postId, userId } });
      await prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
      // Notify post owner
      if (post.userId !== userId) {
        await this.createNotification(post.userId, "NEW_COMMENT", "Yeni beğeni", `${userId} yazınızı beğendi`, postId, "POST");
      }
      return { liked: true, likeCount: post.likeCount + 1 };
    }
  }

  // ============================================
  // COMMENTS
  // ============================================

  static async createComment(userId: string, data: CreateCommentInput) {
    const post = await prisma.post.findUnique({ where: { id: data.postId } });
    if (!post) throw AppError.notFound("POST_NOT_FOUND", "Yazı bulunamadı");

    if (post.visibility === "PRIVATE" && post.userId !== userId) {
      throw AppError.forbidden("PRIVATE_POST", "Bu yazıya yorum yapamazsınız");
    }

    if (data.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: data.parentId } });
      if (!parent || parent.postId !== data.postId) {
        throw AppError.badRequest("INVALID_PARENT", "Geçersiz üst yorum");
      }
    }

    const comment = await prisma.comment.create({
      data: {
        userId,
        postId: data.postId,
        content: data.content,
        parentId: data.parentId,
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });

    await prisma.post.update({ where: { id: data.postId }, data: { commentCount: { increment: 1 } } });

    // Notify post owner
    if (post.userId !== userId) {
      await this.createNotification(post.userId, "NEW_COMMENT", "Yeni yorum", `${userId} yazınıza yorum yaptı`, data.postId, "POST");
    }

    // Notify parent comment owner if reply
    if (data.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: data.parentId } });
      if (parent && parent.userId !== userId) {
        await this.createNotification(parent.userId, "NEW_COMMENT", "Yanıt", `${userId} yorumunuzu yanıtladı`, data.postId, "COMMENT");
      }
    }

    return comment;
  }

  static async getComments(postId: string, filters: { page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { postId, parentId: null }, // Top-level comments only
        include: {
          user: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } },
          replies: {
            include: { user: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } } },
            orderBy: { createdAt: "asc" },
            take: 3, // Show first 3 replies
          },
          _count: { select: { replies: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comment.count({ where: { postId, parentId: null } }),
    ]);

    return { data: comments, meta: calculatePagination(page, limit, total) };
  }

  // ============================================
  // FOLLOWS
  // ============================================

  static async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw AppError.badRequest("SELF_FOLLOW", "Kendinizi takip edemezsiniz");
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existing) {
      throw AppError.conflict("ALREADY_FOLLOWING", "Zaten takip ediyorsunuz");
    }

    await prisma.follow.create({ data: { followerId, followingId } });

    // Notify followed user
    await this.createNotification(followingId, "NEW_FOLLOWER", "Yeni takipçi", "Sizi takip etmeye başladı", followerId, "USER");

    return { following: true };
  }

  static async unfollow(followerId: string, followingId: string) {
    await prisma.follow.deleteMany({ where: { followerId, followingId } });
    return { following: false };
  }

  static async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!follow;
  }

  static async getFollowers(userId: string, filters: { page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: userId },
        include: { follower: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.follow.count({ where: { followingId: userId } }),
    ]);

    return { data: follows.map((f) => f.follower), meta: calculatePagination(page, limit, total) };
  }

  static async getFollowing(userId: string, filters: { page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { select: { id: true, username: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return { data: follows.map((f) => f.following), meta: calculatePagination(page, limit, total) };
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  // Notify all followers of a user about a new post
  static async notifyFollowers(userId: string, type: "NEW_POST", title: string, message: string, referenceId: string, referenceType: string) {
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    });

    if (followers.length === 0) return;

    await prisma.notification.createMany({
      data: followers.map((f) => ({
        userId: f.followerId,
        type,
        title,
        message,
        referenceId,
        referenceType,
      })),
      skipDuplicates: true,
    });
  }

  static async createNotification(
    userId: string,
    type: "NEW_FOLLOWER" | "NEW_POST" | "NEW_COMMENT" | "REVIEW_LIKE" | "TOUR_INVITE" | "SYSTEM",
    title: string,
    message: string,
    referenceId?: string,
    referenceType?: string
  ) {
    return prisma.notification.create({
      data: { userId, type, title, message, referenceId, referenceType },
    });
  }

  static async getNotifications(userId: string, filters: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
    const { page, limit } = getPaginationParams(filters.page, filters.limit);
    const where: any = { userId };
    if (filters.unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data: notifications, meta: calculatePagination(page, limit, total), unreadCount };
  }

  static async markAsRead(userId: string, notificationId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}