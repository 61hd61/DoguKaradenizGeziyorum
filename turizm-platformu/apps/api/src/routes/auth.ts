// Auth Routes - Register, Login, Password Reset, Email Verification
import { FastifyInstance } from "fastify";
import { UserService } from "../services/user.service";
import { AuthService } from "../services/auth.service";
import { validate, getValidatedBody } from "../middleware/validation";
import { authenticate } from "../middleware/auth";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  RefreshTokenSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
} from "@turizm/shared";

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post(
    "/register",
    { schema: { body: RegisterSchema, response: { 201: { type: "object" } } } },
    async (request, reply) => {
      const body = getValidatedBody<typeof RegisterSchema._type>(request);
      const user = await UserService.register(body);
      return reply.status(201).send({
        success: true,
        data: { message: "Kayıt başarılı. E-posta adresinize doğrulama linki gönderildi.", userId: user.id },
      });
    }
  );

  // Login
  fastify.post(
    "/login",
    { schema: { body: LoginSchema } },
    async (request, reply) => {
      const body = getValidatedBody<typeof LoginSchema._type>(request);
      const { user, accessToken, refreshToken } = await UserService.login(body.identifier, body.password);

      // Set refresh token as httpOnly cookie
      reply.setCookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: "/",
      });

      return { success: true, data: { user, accessToken } };
    }
  );

  // Refresh token
  fastify.post(
    "/refresh",
    { schema: { body: RefreshTokenSchema } },
    async (request, reply) => {
      const body = getValidatedBody<typeof RefreshTokenSchema._type>(request);
      const refreshToken = body.refreshToken || request.cookies.refreshToken;
      if (!refreshToken) {
        return reply.status(401).send({ success: false, error: { code: "NO_REFRESH_TOKEN", message: "Refresh token gerekli" } });
      }

      const { user, accessToken, refreshToken: newRefreshToken } = await UserService.refreshToken(refreshToken);

      reply.setCookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return { success: true, data: { user, accessToken } };
    }
  );

  // Logout
  fastify.post(
    "/logout",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const refreshToken = request.cookies.refreshToken;
      if (refreshToken) {
        await UserService.logout(refreshToken);
      }
      reply.clearCookie("refreshToken", { path: "/" });
      return { success: true, data: { message: "Başarıyla çıkış yapıldı" } };
    }
  );

  // Logout all devices
  fastify.post(
    "/logout-all",
    { preHandler: [authenticate] },
    async (request, reply) => {
      await UserService.logoutAll(request.user!.sub);
      reply.clearCookie("refreshToken", { path: "/" });
      return { success: true, data: { message: "Tüm cihazlardan çıkış yapıldı" } };
    }
  );

  // Verify email
  fastify.post(
    "/verify-email",
    { schema: { body: VerifyEmailSchema } },
    async (request, reply) => {
      const body = getValidatedBody<typeof VerifyEmailSchema._type>(request);
      await UserService.verifyEmail(body.token);
      return { success: true, data: { message: "E-posta adresiniz başarıyla doğrulandı" } };
    }
  );

  // Resend verification email
  fastify.post(
    "/resend-verification",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { prisma } = await import("../utils/prisma");
      const user = await prisma.user.findUnique({ where: { id: request.user!.sub } });
      if (!user || user.isEmailVerified) {
        return reply.status(400).send({ success: false, error: { code: "ALREADY_VERIFIED", message: "E-posta zaten doğrulanmış" } });
      }

      const token = await AuthService.createEmailVerificationToken(user.email);
      const { emailService } = await import("../services/email.service");
      await emailService.sendVerificationEmail(user.email, user.username, token);

      return { success: true, data: { message: "Doğrulama e-postası tekrar gönderildi" } };
    }
  );

  // Forgot password
  fastify.post(
    "/forgot-password",
    { schema: { body: ForgotPasswordSchema } },
    async (request, reply) => {
      const body = getValidatedBody<typeof ForgotPasswordSchema._type>(request);
      await UserService.requestPasswordReset(body.email);
      return { success: true, data: { message: "E-posta adresiniz sistemde kayıtlıysa şifre sıfırlama linki gönderildi" } };
    }
  );

  // Reset password
  fastify.post(
    "/reset-password",
    { schema: { body: ResetPasswordSchema } },
    async (request, reply) => {
      const body = getValidatedBody<typeof ResetPasswordSchema._type>(request);
      await UserService.resetPassword(body.token, body.password);
      return { success: true, data: { message: "Şifreniz başarıyla sıfırlandı" } };
    }
  );

  // Get current user profile
  fastify.get(
    "/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = await UserService.getById(request.user!.sub);
      return { success: true, data: user };
    }
  );

  // Update profile
  fastify.patch(
    "/me",
    { preHandler: [authenticate, validate(UpdateProfileSchema)], schema: { body: UpdateProfileSchema } },
    async (request, reply) => {
      const body = getValidatedBody<typeof UpdateProfileSchema._type>(request);
      const profile = await UserService.updateProfile(request.user!.sub, body);
      return { success: true, data: profile };
    }
  );

  // Change password
  fastify.post(
    "/change-password",
    { preHandler: [authenticate, validate(ChangePasswordSchema)], schema: { body: ChangePasswordSchema } },
    async (request, reply) => {
      const body = getValidatedBody<typeof ChangePasswordSchema._type>(request);
      await UserService.changePassword(request.user!.sub, body);
      reply.clearCookie("refreshToken", { path: "/" });
      return { success: true, data: { message: "Şifre değiştirildi. Tekrar giriş yapmanız gerekiyor." } };
    }
  );

  // Delete account
  fastify.delete(
    "/me",
    { preHandler: [authenticate], schema: { body: { type: "object", properties: { password: { type: "string" } }, required: ["password"] } } },
    async (request, reply) => {
      const body = getValidatedBody<{ password: string }>(request);
      await UserService.deleteAccount(request.user!.sub, body.password);
      reply.clearCookie("refreshToken", { path: "/" });
      return { success: true, data: { message: "Hesabınız silindi" } };
    }
  );
}