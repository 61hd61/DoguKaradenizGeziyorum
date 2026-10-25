import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Pool } from "pg";
import { DestinationFilterSchema, isValidEmail, normalizeEmail } from "@turizm/shared";
import { sendPasswordResetEmail, sendVerificationEmail } from "./lib/mail.js";
import { hashPassword, verifyPassword } from "./lib/password.js";
import { publishRevision, subscribeRevision } from "./lib/revision-bus.js";
import {
  decryptPii,
  encryptPii,
  ensureUsersDatabaseSchema,
  userPool,
} from "./lib/user-database.js";

const jwtSecret =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production-min-32-chars-long";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultImagesDir = path.resolve(__dirname, "../../../../destinasyon/images");
const imagesDir = process.env.DESTINATION_IMAGES_DIR || defaultImagesDir;

const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:1234@localhost:5432/trabzon_turizm?schema=public";

const pool = new Pool({ connectionString: databaseUrl.replace("?schema=public", "") });

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_DAYS = parseInt(process.env.JWT_REFRESH_DAYS || "30", 10);

type JwtPayload = { sub: string; username?: string; role: string };

async function readDestinationRevision(): Promise<string> {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX("updatedAt"), NOW())::text AS rev FROM destinations WHERE "isActive" = true`
  );
  return String(rows[0]?.rev ?? new Date().toISOString());
}

async function bumpDestinationRevision(reason?: string) {
  const rev = await readDestinationRevision();
  publishRevision(rev, reason);
  return rev;
}

async function mirrorUserToMain(params: {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  firstName: string;
  lastName: string;
  encryptedBio: string;
}) {
  await pool.query(
    `INSERT INTO users (id, username, email, "passwordHash", role, "isEmailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'USER'::"UserRole", $5, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       email = EXCLUDED.email,
       "passwordHash" = EXCLUDED."passwordHash",
       "isEmailVerified" = EXCLUDED."isEmailVerified",
       "updatedAt" = NOW()`,
    [params.id, params.username, params.email, params.passwordHash, params.isEmailVerified]
  );
  await pool.query(
    `INSERT INTO user_profiles (id, "userId", "firstName", "lastName", bio, "encryptedData", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, '[encrypted]', $4, NOW(), NOW())
     ON CONFLICT ("userId") DO UPDATE SET
       "firstName" = EXCLUDED."firstName",
       "lastName" = EXCLUDED."lastName",
       "encryptedData" = EXCLUDED."encryptedData",
       "updatedAt" = NOW()`,
    [params.id, params.firstName, params.lastName, params.encryptedBio]
  );
}

function signAccessToken(user: { id: string; username: string; role: string }) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, jwtSecret, {
    expiresIn: ACCESS_TTL as SignOptions["expiresIn"],
  });
}

async function createRefreshToken(userId: string) {
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  await userPool.query(
    `INSERT INTO refresh_tokens (id, "userId", token_hash, "expiresAt", revoked, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW() + ($3 || ' days')::interval, false, NOW())`,
    [userId, tokenHash, String(REFRESH_DAYS)]
  );
  return raw;
}

function setRefreshCookie(reply: { setCookie: (name: string, val: string, opts: object) => void }, token: string) {
  reply.setCookie("turizm_refresh", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: REFRESH_DAYS * 86400,
    secure: process.env.NODE_ENV === "production",
  });
}

function readToken(authHeader?: string): JwtPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

function requireRole(
  request: { headers: { authorization?: string } },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  roles: string[]
): JwtPayload | null {
  const payload = readToken(request.headers.authorization);
  if (!payload) {
    reply.status(401).send({ success: false, error: { message: "Oturum gerekli" } });
    return null;
  }
  if (!roles.includes(payload.role)) {
    reply.status(403).send({ success: false, error: { message: "Yetki yok" } });
    return null;
  }
  return payload;
}

async function ensureDefaultAdmin() {
  const email = "admin@turizm.local";
  const hash = await bcrypt.hash("admin123", 12);
  try {
    const { rows } = await pool.query(
      `SELECT id, "passwordHash" FROM admin_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    if (!rows[0]) {
      await pool.query(
        `INSERT INTO admin_users (id, email, "passwordHash", name, role, permissions, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, 'Yönetici', 'SUPER_ADMIN', ARRAY['*']::text[], true, NOW(), NOW())`,
        [email, hash]
      );
    } else if (!String(rows[0].passwordHash).startsWith("$2")) {
      await pool.query(`UPDATE admin_users SET "passwordHash" = $1, "updatedAt" = NOW() WHERE id = $2`, [
        hash,
        rows[0].id,
      ]);
    }
  } catch (err) {
    console.warn("admin_users hazirlanamadi (tablo yok olabilir):", err);
  }
}

async function start() {
  const app = Fastify({
    logger:
      process.env.NODE_ENV === "production"
        ? { level: process.env.LOG_LEVEL || "info" }
        : { level: process.env.LOG_LEVEL || "info", transport: { target: "pino-pretty" } },
  });

  await app.register(fastifyCors, {
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000,http://localhost:8081").split(","),
    credentials: true,
  });

  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(fastifyStatic, {
    root: imagesDir,
    prefix: "/images/",
    decorateReply: false,
  });
  app.log.info(`Serving destination images from ${imagesDir}`);

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

app.get("/api/v1/destinations/types", async () => {
  const { rows } = await pool.query(
    `SELECT id, name, slug, icon, color, "sortOrder"
     FROM destination_types
     WHERE "isActive" = true
     ORDER BY "sortOrder" ASC, name ASC`
  );
  return { success: true, data: rows };
});

app.get("/api/v1/destinations/provinces", async () => {
  const { rows } = await pool.query(
    `SELECT id, name, slug, code, latitude, longitude, zoom
     FROM provinces
     ORDER BY name ASC`
  );
  return { success: true, data: rows };
});

app.get("/api/v1/destinations/provinces/:provinceId/districts", async (request) => {
  const { provinceId } = request.params as { provinceId: string };
  const { rows } = await pool.query(
    `SELECT id, name, slug, "provinceId", latitude, longitude
     FROM districts
     WHERE "provinceId" = $1
     ORDER BY name ASC`,
    [provinceId]
  );
  return { success: true, data: rows };
});

app.get("/api/v1/destinations", async (request, reply) => {
  const parsed = DestinationFilterSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Geçersiz filtre", details: parsed.error.flatten() },
    });
  }

  const filters = parsed.data;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };

  if (filters.isActive !== false) add(`d."isActive" = ?`, true);
  if (filters.search) {
    const q = `%${filters.search}%`;
    params.push(q, q, q, q, q);
    const i = params.length;
    where.push(
      `(d.name ILIKE $${i - 4} OR d.description ILIKE $${i - 3} OR d."shortDescription" ILIKE $${i - 2} OR p.name ILIKE $${i - 1} OR t.name ILIKE $${i})`
    );
  }
  if (filters.provinceId) add(`d."provinceId" = ?`, filters.provinceId);
  if (filters.districtId) add(`d."districtId" = ?`, filters.districtId);
  if (filters.typeId) add(`d."typeId" = ?`, filters.typeId);
  if (filters.isFeatured !== undefined) add(`d."isFeatured" = ?`, filters.isFeatured);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortMap: Record<string, string> = {
    name: "d.name",
    rating: `d."averageRating"`,
    reviewCount: `d."reviewCount"`,
    viewCount: `d."viewCount"`,
    createdAt: `d."createdAt"`,
    distance: "d.name",
  };
  const sortCol = sortMap[filters.sortBy] ?? "d.name";
  const sortDir = filters.sortOrder === "desc" ? "DESC" : "ASC";
  const page = filters.page;
  const limit = filters.limit;
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM destinations d
    LEFT JOIN provinces p ON p.id = d."provinceId"
    LEFT JOIN destination_types t ON t.id = d."typeId"
    ${whereSql}
  `;
  const listSql = `
    SELECT d.id, d.name, d.slug, d.description, d."shortDescription",
           d.latitude, d.longitude, d."thumbnailUrl", d.images, d."isActive", d."isFeatured",
           d."averageRating", d."reviewCount",
           json_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'color', t.color, 'icon', t.icon) AS type,
           json_build_object('id', p.id, 'name', p.name, 'slug', p.slug) AS province
    FROM destinations d
    LEFT JOIN provinces p ON p.id = d."provinceId"
    LEFT JOIN destination_types t ON t.id = d."typeId"
    ${whereSql}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const [countRes, listRes] = await Promise.all([
    pool.query(countSql, params),
    pool.query(listSql, [...params, limit, offset]),
  ]);

  const total = countRes.rows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    success: true,
    data: listRes.rows,
    meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  };
});

app.get("/api/v1/admin/overview", async () => {
  const safeCount = async (sql: string) => {
    try {
      const { rows } = await pool.query(sql);
      return rows[0]?.c ?? 0;
    } catch {
      return 0;
    }
  };
  const [destinations, provinces, types, users, reviews, posts, tours] = await Promise.all([
    safeCount('SELECT COUNT(*)::int AS c FROM destinations WHERE "isActive" = true'),
    safeCount("SELECT COUNT(*)::int AS c FROM provinces"),
    safeCount('SELECT COUNT(*)::int AS c FROM destination_types WHERE "isActive" = true'),
    safeCount("SELECT COUNT(*)::int AS c FROM users"),
    safeCount("SELECT COUNT(*)::int AS c FROM reviews"),
    safeCount("SELECT COUNT(*)::int AS c FROM posts"),
    safeCount("SELECT COUNT(*)::int AS c FROM user_tours"),
  ]);
  const { rows: byProvince } = await pool.query(`
    SELECT p.name, COUNT(d.id)::int AS count
    FROM provinces p
    LEFT JOIN destinations d ON d."provinceId" = p.id AND d."isActive" = true
    GROUP BY p.name
    ORDER BY p.name
  `);
  return {
    success: true,
    data: { destinations, provinces, types, users, reviews, posts, tours, byProvince },
  };
});

app.post("/api/v1/auth/admin/login", async (request, reply) => {
  const body = request.body as { email?: string; password?: string };
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) {
    return reply.status(400).send({ success: false, error: { message: "E-posta ve şifre gerekli" } });
  }
  const { rows } = await pool.query(
    `SELECT id, email, name, role, "passwordHash", "isActive"
     FROM admin_users WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  const admin = rows[0];
  if (!admin?.isActive || !(await bcrypt.compare(password, admin.passwordHash))) {
    return reply.status(401).send({ success: false, error: { message: "Geçersiz yönetici bilgileri" } });
  }
  await pool.query(`UPDATE admin_users SET "lastLoginAt" = NOW() WHERE id = $1`, [admin.id]);
  const token = jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN" },
    jwtSecret,
    { expiresIn: "12h" }
  );
  return {
    success: true,
    data: {
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      accessToken: token,
    },
  };
});

app.get("/api/v1/admin/users", async (request, reply) => {
  const auth = requireRole(request, reply, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const { rows } = await userPool.query(
    `SELECT u.id, u.username, u.email, u.role, u."isEmailVerified", u."createdAt",
            u."passwordHash",
            p."firstName", p."lastName", p."encryptedData"
     FROM users u
     LEFT JOIN user_profiles p ON p."userId" = u.id
     ORDER BY u."createdAt" DESC
     LIMIT 100`
  );
  const data = rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    isEmailVerified: row.isEmailVerified,
    createdAt: row.createdAt,
    firstName: row.firstName,
    lastName: row.lastName,
    bio: "[admin göremez — şifreli]",
    passwordHashPreview: String(row.passwordHash || "").slice(0, 48) + "…",
    profileEncrypted: Boolean(row.encryptedData),
  }));
  return { success: true, data };
});

app.get("/api/v1/admin/reviews", async (request, reply) => {
  const auth = requireRole(request, reply, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const { rows } = await pool.query(
    `SELECT r.id, r.rating, r.content, r."createdAt", r."isApproved",
            u.username, d.name AS destination
     FROM reviews r
     JOIN users u ON u.id = r."userId"
     JOIN destinations d ON d.id = r."destinationId"
     ORDER BY r."createdAt" DESC
     LIMIT 50`
  );
  return { success: true, data: rows };
});

app.get("/api/v1/social/users/:username", async (request, reply) => {
  const { username } = request.params as { username: string };
  const uname = username.replace(/^@/, "");
  const { rows } = await pool.query(
    `
    SELECT u.id, u.username, u."avatarUrl", u."createdAt",
           p."firstName", p."lastName", p.bio,
           (SELECT COUNT(*)::int FROM followers f WHERE f."followingId" = u.id) AS followers,
           (SELECT COUNT(*)::int FROM followers f WHERE f."followerId" = u.id) AS following,
           (SELECT COUNT(*)::int FROM posts po WHERE po."userId" = u.id) AS posts
    FROM users u
    LEFT JOIN user_profiles p ON p."userId" = u.id
    WHERE lower(u.username) = lower($1)
    LIMIT 1
    `,
    [uname]
  );
  if (!rows[0]) {
    return reply.status(404).send({ success: false, error: { message: "Kullanıcı bulunamadı" } });
  }
  return { success: true, data: rows[0] };
});

app.get("/api/v1/social/users/:username/posts", async (request) => {
  const { username } = request.params as { username: string };
  const uname = username.replace(/^@/, "");
  const { rows } = await pool.query(
    `
    SELECT po.id, po.title, po.content, po.images, po."likeCount", po."commentCount",
           po."publishedAt", po."createdAt"
    FROM posts po
    JOIN users u ON u.id = po."userId"
    WHERE lower(u.username) = lower($1)
    ORDER BY po."createdAt" DESC
    LIMIT 30
    `,
    [uname]
  );
  return { success: true, data: rows };
});

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

function isValidUsernameLocal(username: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]$|^[a-z0-9]{3,50}$/.test(username);
}

function registerErrorMessage(err: unknown): { status: number; message: string } {
  const pg = err as { code?: string; constraint?: string; detail?: string };
  if (pg.code === "23505") {
    const c = (pg.constraint || "").toLowerCase();
    const d = (pg.detail || "").toLowerCase();
    if (c.includes("email") || d.includes("email")) {
      return { status: 409, message: "Bu e-posta adresi zaten kayıtlı" };
    }
    if (c.includes("username") || d.includes("username")) {
      return { status: 409, message: "Bu kullanıcı adı zaten alınmış" };
    }
    return { status: 409, message: "Bu bilgilerle kayıt zaten var" };
  }
  return { status: 500, message: "Kayıt tamamlanamadı. Lütfen tekrar deneyin." };
}

app.post(
  "/api/v1/auth/register",
  { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
  async (request, reply) => {
  const body = request.body as {
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    password?: string;
  };
  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const username = normalizeUsername(body.username || "");
  const email = normalizeEmail(body.email || "");
  const password = body.password || "";
  if (!firstName || !lastName || !username || !email || password.length < 6) {
    return reply.status(400).send({ success: false, error: { message: "Tüm alanları doldurun (şifre en az 6 karakter)" } });
  }
  if (!isValidEmail(email)) {
    return reply.status(400).send({
      success: false,
      error: {
        message:
          "Geçerli bir e-posta girin (Gmail, Outlook, Yahoo, iCloud, Hotmail, kurumsal vb. — örn. ad.soyad@gmail.com)",
      },
    });
  }
  if (!isValidUsernameLocal(username)) {
    return reply.status(400).send({
      success: false,
      error: { message: "Kullanıcı adı 3–50 karakter; harf, rakam, nokta, tire, alt çizgi kullanılabilir" },
    });
  }
  const hash = await hashPassword(password);
  const userId = crypto.randomUUID();
  const encryptedBio = encryptPii("");
  const client = await userPool.connect();
  try {
    await client.query("BEGIN");
    const userRes = await client.query(
      `INSERT INTO users (id, username, email, "passwordHash", role, "isEmailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'USER', false, NOW(), NOW())
       RETURNING id, username, email, "avatarUrl"`,
      [userId, username, email, hash]
    );
    const user = userRes.rows[0];
    await client.query(
      `INSERT INTO user_profiles (id, "userId", "firstName", "lastName", bio, "encryptedData", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, '', $4, NOW(), NOW())`,
      [user.id, firstName, lastName, encryptedBio]
    );
    const verifyToken = crypto.randomBytes(32).toString("hex");
    await client.query(
      `INSERT INTO email_verification_tokens (id, email, token, "expiresAt", used, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, NOW() + interval '1 day', false, NOW())`,
      [email, verifyToken]
    );
    await client.query("COMMIT");
    await mirrorUserToMain({
      id: user.id,
      username,
      email,
      passwordHash: hash,
      isEmailVerified: false,
      firstName,
      lastName,
      encryptedBio,
    });
    await sendVerificationEmail(email, verifyToken, request.log);
    return reply.status(201).send({
      success: true,
      data: {
        user: { ...user, firstName, lastName, isEmailVerified: false },
        message: "Kayıt alındı. Giriş için e-posta adresinizi doğrulayın.",
        requiresEmailVerification: true,
      },
    });
  } catch (e) {
    await client.query("ROLLBACK");
    request.log.error(e);
    const { status, message } = registerErrorMessage(e);
    return reply.status(status).send({ success: false, error: { message } });
  } finally {
    client.release();
  }
});

app.post(
  "/api/v1/auth/login",
  { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
  async (request, reply) => {
  const body = request.body as { identifier?: string; password?: string };
  const identifier = (body.identifier || "").trim().replace(/^@/, "");
  const password = body.password || "";
  if (!identifier || !password) {
    return reply.status(400).send({ success: false, error: { message: "Giriş bilgileri gerekli" } });
  }
  let user: Record<string, unknown> | undefined;
  try {
    const { rows } = await userPool.query(
      `SELECT u.id, u.username, u.email, u."passwordHash", u."avatarUrl", u.role, u."isEmailVerified",
              p."firstName", p."lastName", p."encryptedData"
       FROM users u
       LEFT JOIN user_profiles p ON p."userId" = u.id
       WHERE lower(u.email) = lower($1) OR lower(u.username) = lower($1)
       LIMIT 1`,
      [identifier]
    );
    user = rows[0];
  } catch {
    user = undefined;
  }
  if (!user) {
    const { rows: legacy } = await pool.query(
      `SELECT u.id, u.username, u.email, u."passwordHash", u."avatarUrl", u.role, u."isEmailVerified",
              p."firstName", p."lastName", p.bio AS "encryptedData"
       FROM users u
       LEFT JOIN user_profiles p ON p."userId" = u.id
       WHERE lower(u.email) = lower($1) OR lower(u.username) = lower($1)
       LIMIT 1`,
      [identifier]
    );
    user = legacy[0];
    if (user && user.isEmailVerified === undefined) user.isEmailVerified = true;
  }
  if (!user || !(await verifyPassword(password, String(user.passwordHash || "")))) {
    return reply.status(401).send({ success: false, error: { message: "Geçersiz kullanıcı veya şifre" } });
  }
  if (!user.isEmailVerified && process.env.SKIP_EMAIL_VERIFY !== "true") {
    return reply.status(403).send({
      success: false,
      error: { message: "E-posta doğrulanmamış. Gelen kutunuzdaki bağlantıya tıklayın." },
    });
  }
  await userPool.query(`UPDATE users SET "lastLoginAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`, [user.id]).catch(() => undefined);
  const accessToken = signAccessToken({
    id: String(user.id),
    username: String(user.username),
    role: String(user.role || "USER"),
  });
  const refresh = await createRefreshToken(String(user.id)).catch(async () => "");
  if (refresh) setRefreshCookie(reply, refresh);
  delete user.passwordHash;
  const enc = String(user.encryptedData || "");
  user.bio = enc.startsWith("ey") || enc.length > 40 ? decryptPii(enc) : enc;
  delete user.encryptedData;
  return { success: true, data: { user, accessToken } };
});

app.post("/api/v1/auth/verify-email", async (request, reply) => {
  const body = request.body as { token?: string };
  const token = (body.token || "").trim();
  if (!token) {
    return reply.status(400).send({ success: false, error: { message: "Token gerekli" } });
  }
  const { rows } = await userPool.query(
    `SELECT email FROM email_verification_tokens
     WHERE token = $1 AND used = false AND "expiresAt" > NOW()
     LIMIT 1`,
    [token]
  );
  if (!rows[0]) {
    return reply.status(400).send({ success: false, error: { message: "Geçersiz veya süresi dolmuş bağlantı" } });
  }
  const email = rows[0].email as string;
  await userPool.query(
    `UPDATE users SET "isEmailVerified" = true, "emailVerifiedAt" = NOW(), "updatedAt" = NOW()
     WHERE lower(email) = lower($1)`,
    [email]
  );
  await pool.query(
    `UPDATE users SET "isEmailVerified" = true, "emailVerifiedAt" = NOW(), "updatedAt" = NOW()
     WHERE lower(email) = lower($1)`,
    [email]
  );
  await userPool.query(`UPDATE email_verification_tokens SET used = true WHERE token = $1`, [token]);
  return { success: true, data: { message: "E-posta doğrulandı. Giriş yapabilirsiniz." } };
});

app.post("/api/v1/auth/refresh", async (request, reply) => {
  const raw = request.cookies?.turizm_refresh;
  if (!raw) {
    return reply.status(401).send({ success: false, error: { message: "Refresh oturumu yok" } });
  }
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const { rows } = await userPool.query(
    `SELECT rt."userId", u.username, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt."userId"
     WHERE rt.token_hash = $1 AND rt.revoked = false AND rt."expiresAt" > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  if (!rows[0]) {
    return reply.status(401).send({ success: false, error: { message: "Oturum süresi doldu" } });
  }
  const accessToken = signAccessToken({
    id: rows[0].userId,
    username: rows[0].username,
    role: rows[0].role || "USER",
  });
  const refresh = await createRefreshToken(rows[0].userId);
  setRefreshCookie(reply, refresh);
  return { success: true, data: { accessToken } };
});

app.post("/api/v1/auth/reset-password", async (request, reply) => {
  const body = request.body as { token?: string; password?: string };
  const token = (body.token || "").trim();
  const password = body.password || "";
  if (!token || password.length < 6) {
    return reply.status(400).send({ success: false, error: { message: "Token ve yeni şifre (min 6) gerekli" } });
  }
  const { rows } = await userPool.query(
    `SELECT email FROM password_reset_tokens
     WHERE token = $1 AND used = false AND "expiresAt" > NOW() LIMIT 1`,
    [token]
  );
  if (!rows[0]) {
    return reply.status(400).send({ success: false, error: { message: "Geçersiz sıfırlama bağlantısı" } });
  }
  const email = rows[0].email as string;
  const hash = await hashPassword(password);
  await userPool.query(
    `UPDATE users SET "passwordHash" = $1, "updatedAt" = NOW() WHERE lower(email) = lower($2)`,
    [hash, email]
  );
  await pool.query(
    `UPDATE users SET "passwordHash" = $1, "updatedAt" = NOW() WHERE lower(email) = lower($2)`,
    [hash, email]
  );
  await userPool.query(`UPDATE password_reset_tokens SET used = true WHERE token = $1`, [token]);
  return { success: true, data: { message: "Şifre güncellendi" } };
});

app.patch("/api/v1/social/me/profile", async (request, reply) => {
  const auth = requireRole(request, reply, ["USER", "ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const body = request.body as { bio?: string; firstName?: string; lastName?: string };
  const bio = body.bio !== undefined ? String(body.bio).slice(0, 500) : undefined;
  const firstName = body.firstName !== undefined ? String(body.firstName).slice(0, 80) : undefined;
  const lastName = body.lastName !== undefined ? String(body.lastName).slice(0, 80) : undefined;
  const encBio = bio !== undefined ? encryptPii(bio) : undefined;
  await userPool.query(
    `UPDATE user_profiles SET
       bio = CASE WHEN $1::text IS NOT NULL THEN '' ELSE bio END,
       "encryptedData" = COALESCE($1, "encryptedData"),
       "firstName" = COALESCE($2, "firstName"),
       "lastName" = COALESCE($3, "lastName"),
       "updatedAt" = NOW()
     WHERE "userId" = $4`,
    [encBio ?? null, firstName ?? null, lastName ?? null, auth.sub]
  );
  await pool.query(
    `UPDATE user_profiles SET
       bio = '[encrypted]',
       "encryptedData" = COALESCE($1, "encryptedData"),
       "firstName" = COALESCE($2, "firstName"),
       "lastName" = COALESCE($3, "lastName"),
       "updatedAt" = NOW()
     WHERE "userId" = $4`,
    [encBio ?? null, firstName ?? null, lastName ?? null, auth.sub]
  );
  return { success: true, data: { ok: true } };
});

app.post("/api/v1/social/posts", async (request, reply) => {
  const auth = requireRole(request, reply, ["USER", "ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const body = request.body as { title?: string; content?: string };
  const title = (body.title || "Hatıra").trim().slice(0, 200);
  const content = (body.content || "").trim();
  if (content.length < 2) {
    return reply.status(400).send({ success: false, error: { message: "Gönderi metni çok kısa" } });
  }
  const { rows } = await pool.query(
    `INSERT INTO posts (id, "userId", title, content, images, visibility, "publishedAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, '{}', 'PUBLIC'::"PostVisibility", NOW(), NOW(), NOW())
     RETURNING id, title, content, images, "likeCount", "commentCount", "createdAt"`,
    [auth.sub, title, content]
  );
  return reply.status(201).send({ success: true, data: rows[0] });
});

app.post("/api/v1/social/users/:username/follow", async (request, reply) => {
  const auth = requireRole(request, reply, ["USER", "ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const { username } = request.params as { username: string };
  const uname = username.replace(/^@/, "");
  const { rows: targetRows } = await pool.query(
    `SELECT id FROM users WHERE lower(username) = lower($1) LIMIT 1`,
    [uname]
  );
  const targetId = targetRows[0]?.id;
  if (!targetId) {
    return reply.status(404).send({ success: false, error: { message: "Kullanıcı bulunamadı" } });
  }
  if (targetId === auth.sub) {
    return reply.status(400).send({ success: false, error: { message: "Kendinizi takip edemezsiniz" } });
  }
  await pool.query(
    `INSERT INTO followers (id, "followerId", "followingId", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW())
     ON CONFLICT ("followerId", "followingId") DO NOTHING`,
    [auth.sub, targetId]
  );
  return { success: true, data: { following: true } };
});

app.get("/api/v1/sync/revision", async () => {
  const rev = await readDestinationRevision();
  return { success: true, data: { revision: rev } };
});

app.get("/api/v1/sync/events", async (request, reply) => {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = async (reason?: string) => {
    const rev = await readDestinationRevision();
    reply.raw.write(`data: ${JSON.stringify({ revision: rev, reason })}\n\n`);
  };
  await send("connected");
  const unsub = subscribeRevision(({ revision, reason }) => {
    reply.raw.write(`data: ${JSON.stringify({ revision, reason })}\n\n`);
  });
  const heartbeat = setInterval(() => {
    reply.raw.write(": ping\n\n");
  }, 15000);
  request.raw.on("close", () => {
    clearInterval(heartbeat);
    unsub();
  });
});

app.get("/api/v1/translate", async (request, reply) => {
  const q = request.query as { text?: string; target?: string; source?: string };
  const text = (q.text || "").trim();
  const target = (q.target || "en").slice(0, 5);
  const source = (q.source || "tr").slice(0, 5);
  if (!text || text.length > 2000) {
    return reply.status(400).send({ success: false, error: { message: "Geçersiz metin" } });
  }
  const base = process.env.LIBRETRANSLATE_URL || "https://libretranslate.com";
  try {
    const res = await fetch(`${base}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source, target, format: "text" }),
    });
    const json = (await res.json()) as { translatedText?: string };
    return { success: true, data: { text: json.translatedText ?? text } };
  } catch {
    return { success: true, data: { text, fallback: true } };
  }
});

app.get("/api/v1/weather", async (request, reply) => {
  const q = request.query as { lat?: string; lon?: string };
  const lat = parseFloat(q.lat || "40.99");
  const lon = parseFloat(q.lon || "39.72");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return reply.status(400).send({ success: false, error: { message: "Geçersiz koordinat" } });
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
    };
    const code = json.current?.weather_code ?? 0;
    const temp = json.current?.temperature_2m ?? null;
    let mood: "sunny" | "rain" | "snow" | "cloud" = "cloud";
    if ([71, 73, 75, 77, 85, 86].includes(code)) mood = "snow";
    else if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) mood = "rain";
    else if ([0, 1].includes(code) && json.current?.is_day === 1) mood = "sunny";
    const packing: string[] =
      mood === "rain"
        ? ["Yağmurluk", "Su geçirmez ayakkabı"]
        : mood === "snow"
          ? ["Mont", "Eldiven", "Kaymaz bot"]
          : mood === "sunny"
            ? ["Güneş kremi", "Şapka", "Su şişesi"]
            : ["Hafif ceket", "Rahat ayakkabı"];
    return { success: true, data: { temp, weatherCode: code, mood, packing } };
  } catch {
    return reply.status(502).send({ success: false, error: { message: "Hava durumu alınamadı" } });
  }
});

app.get("/api/v1/destinations/item/:key", async (request, reply) => {
  const { key } = request.params as { key: string };
  const { rows } = await pool.query(
    `
    SELECT d.id, d.name, d.slug, d.description, d."shortDescription",
           d.latitude, d.longitude, d.images, d."thumbnailUrl",
           d."averageRating", d."reviewCount", d."viewCount",
           json_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'color', t.color, 'icon', t.icon) AS type,
           json_build_object('id', p.id, 'name', p.name, 'slug', p.slug) AS province
    FROM destinations d
    LEFT JOIN destination_types t ON t.id = d."typeId"
    LEFT JOIN provinces p ON p.id = d."provinceId"
    WHERE d."isActive" = true AND (d.id::text = $1 OR lower(d.slug) = lower($1))
    LIMIT 1
    `,
    [key]
  );
  if (!rows[0]) {
    return reply.status(404).send({ success: false, error: { message: "Destinasyon bulunamadı" } });
  }
  await pool.query(`UPDATE destinations SET "viewCount" = COALESCE("viewCount", 0) + 1 WHERE id = $1`, [
    rows[0].id,
  ]);
  return { success: true, data: rows[0] };
});

app.post("/api/v1/destinations/item/:id/click", async (request) => {
  const { id } = request.params as { id: string };
  const auth = readToken(request.headers.authorization);
  await pool
    .query(
      `INSERT INTO clicks (id, "destinationId", "userId", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, NOW())`,
      [id, auth?.sub ?? null]
    )
    .catch(() => undefined);
  return { success: true };
});

app.get("/api/v1/destinations/item/:id/reviews", async (request) => {
  const { id } = request.params as { id: string };
  const { rows } = await pool.query(
    `
    SELECT r.id, r.rating, r.content, r.category, r."createdAt",
           u.username
    FROM reviews r
    JOIN users u ON u.id = r."userId"
    WHERE r."destinationId" = $1 AND r."isApproved" = true
    ORDER BY r."createdAt" DESC
    LIMIT 50
    `,
    [id]
  );
  return { success: true, data: rows };
});

app.post("/api/v1/destinations/item/:id/reviews", async (request, reply) => {
  const auth = requireRole(request, reply, ["USER", "ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const { id } = request.params as { id: string };
  const body = request.body as { content?: string; rating?: number; category?: string };
  const content = (body.content || "").trim();
  const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
  const cat = (body.category || "SOLO").toUpperCase();
  const allowed = ["FAMILY", "ADULT", "SOLO", "FRIENDS"];
  if (!content || content.length < 3) {
    return reply.status(400).send({ success: false, error: { message: "Yorum metni gerekli" } });
  }
  if (!allowed.includes(cat)) {
    return reply.status(400).send({ success: false, error: { message: "Geçersiz kategori" } });
  }
  const { rows } = await pool.query(
    `
    INSERT INTO reviews (id, "userId", "destinationId", category, content, rating, "isApproved", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, $1, $2, $3::"ReviewCategory", $4, $5, true, NOW(), NOW())
    RETURNING id, rating, content, category, "createdAt"
    `,
    [auth.sub, id, cat, content, rating]
  );
  await pool.query(`UPDATE destinations SET "reviewCount" = COALESCE("reviewCount", 0) + 1 WHERE id = $1`, [id]);
  return reply.status(201).send({ success: true, data: rows[0] });
});

app.get("/api/v1/tours/popular-routes", async () => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, "destinationIds", "usageCount", "averageRating"
       FROM popular_routes
       ORDER BY "usageCount" DESC
       LIMIT 10`
    );
    return { success: true, data: rows };
  } catch {
    return { success: true, data: [] };
  }
});

app.post("/api/v1/auth/forgot-password", async (request, reply) => {
  const body = request.body as { email?: string };
  const email = normalizeEmail(body.email || "");
  if (!isValidEmail(email)) {
    return reply.status(400).send({ success: false, error: { message: "Geçerli e-posta girin" } });
  }
  const { rows } = await userPool.query(`SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`, [email]);
  if (!rows[0]) {
    return reply.status(404).send({ success: false, error: { message: "Kullanıcı bulunamadı" } });
  }
  const token = crypto.randomBytes(32).toString("hex");
  await userPool.query(
    `INSERT INTO password_reset_tokens (id, email, token, "expiresAt", used, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW() + interval '1 day', false, NOW())`,
    [email, token]
  );
  await sendPasswordResetEmail(email, token, request.log);
  return {
    success: true,
    data: { message: "Kayıtlı e-posta ise sıfırlama bağlantısı gönderildi." },
  };
});

app.get("/api/v1/admin/analytics", async (request, reply) => {
  const auth = requireRole(request, reply, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const clicks = await pool
    .query(`SELECT COUNT(*)::int AS c FROM clicks`)
    .then((r) => r.rows[0]?.c ?? 0)
    .catch(() => 0);
  const topDest = await pool
    .query(
      `SELECT d.name, d."viewCount", d."reviewCount", p.name AS province
       FROM destinations d
       LEFT JOIN provinces p ON p.id = d."provinceId"
       ORDER BY d."viewCount" DESC NULLS LAST
       LIMIT 10`
    )
    .then((r) => r.rows)
    .catch(() => []);
  const routes = await pool
    .query(`SELECT name, "usageCount" FROM popular_routes ORDER BY "usageCount" DESC LIMIT 5`)
    .then((r) => r.rows)
    .catch(() => []);
  return { success: true, data: { clicks, topDestinations: topDest, popularRoutes: routes } };
});

app.get("/api/v1/admin/destinations", async (request, reply) => {
  const auth = requireRole(request, reply, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const q = request.query as { search?: string; limit?: string };
  const limit = Math.min(100, parseInt(q.limit || "50", 10));
  const search = (q.search || "").trim();
  const params: unknown[] = [];
  let where = `WHERE d."isActive" = true`;
  if (search) {
    params.push(`%${search}%`);
    where += ` AND d.name ILIKE $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT d.id, d.name, d.slug, d."shortDescription", d.description, d."isActive", d."isFeatured",
            p.name AS province, t.name AS type
     FROM destinations d
     LEFT JOIN provinces p ON p.id = d."provinceId"
     LEFT JOIN destination_types t ON t.id = d."typeId"
     ${where}
     ORDER BY d.name ASC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );
  return { success: true, data: rows };
});

app.patch("/api/v1/admin/destinations/:id", async (request, reply) => {
  const auth = requireRole(request, reply, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const { id } = request.params as { id: string };
  const body = request.body as {
    name?: string;
    shortDescription?: string;
    description?: string;
    isFeatured?: boolean;
  };
  const { rowCount } = await pool.query(
    `UPDATE destinations SET
       name = COALESCE($1, name),
       "shortDescription" = COALESCE($2, "shortDescription"),
       description = COALESCE($3, description),
       "isFeatured" = COALESCE($4, "isFeatured"),
       "updatedAt" = NOW()
     WHERE id = $5`,
    [
      body.name?.trim() || null,
      body.shortDescription ?? null,
      body.description ?? null,
      body.isFeatured ?? null,
      id,
    ]
  );
  if (!rowCount) {
    return reply.status(404).send({ success: false, error: { message: "Destinasyon bulunamadı" } });
  }
  await bumpDestinationRevision("admin-update");
  return { success: true, data: { ok: true } };
});

app.delete("/api/v1/admin/destinations/:id", async (request, reply) => {
  const auth = requireRole(request, reply, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return;
  const { id } = request.params as { id: string };
  await pool.query(`UPDATE destinations SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1`, [id]);
  await bumpDestinationRevision("admin-delete");
  return { success: true, data: { ok: true } };
});

  try {
    await ensureUsersDatabaseSchema();
    app.log.info("Kullanici veritabani (trabzon_turizm_users) hazir");
  } catch (err) {
    app.log.warn({ err }, "Kullanici DB acilamadi — USER_DATABASE_URL kontrol edin");
  }

  await ensureDefaultAdmin();

  try {
    await app.listen({ port, host });
    app.log.info(`Server running at http://${host}:${port}`);
    app.log.info(`Health: http://localhost:${port}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
