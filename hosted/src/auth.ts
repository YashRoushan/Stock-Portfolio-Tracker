import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Context, Next } from "hono";
import type { HostedBindings, SessionUser, UserRow } from "./types";

export type ApiEnvironment = {
  Bindings: HostedBindings;
  Variables: { user: SessionUser };
};

const issuer = "yash-stock-portfolio-demo";
const audience = "stock-portfolio-api";
const windowSeconds = 15 * 60;

function signingKey(secret: string) {
  if (!secret || secret.length < 32) throw new Error("Authentication is not configured");
  return new TextEncoder().encode(secret);
}

export function sessionUser(row: UserRow): SessionUser {
  return { id: row.id, email: row.email, isDemo: Boolean(row.is_demo) };
}

export async function issueToken(user: SessionUser, secret: string) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(signingKey(secret));
}

export async function authenticate(c: Context<ApiEnvironment>, next: Next) {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { payload } = await jwtVerify(authorization.slice(7), signingKey(c.env.JWT_SECRET), {
      algorithms: ["HS256"], issuer, audience,
    });
    if (typeof payload.sub !== "string") return c.json({ error: "Unauthorized" }, 401);
    const row = await c.env.DB.prepare(
      "SELECT id, email, password_hash, is_demo, expires_at FROM users WHERE id = ?",
    ).bind(payload.sub).first<UserRow>();
    if (!row || (row.expires_at && row.expires_at <= new Date().toISOString())) {
      return c.json({ error: "Your session has expired. Sign in or start a new demo." }, 401);
    }
    c.set("user", sessionUser(row));
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function passwordMatches(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Durable, atomic per-client limits; the database never stores a raw IP address. */
export async function limitAuthentication(c: Context<ApiEnvironment>, next: Next) {
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / windowSeconds);
  const address = c.req.header("CF-Connecting-IP") || c.req.header("X-Real-IP");
  const name = c.req.path.split("/").pop() || "auth";
  const key = await crypto.subtle.importKey(
    "raw", signingKey(c.env.JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`rate-limit:${address || "unattributed"}:${name}:${window}`),
  );
  const digest = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const limit = address ? (name === "login" ? 60 : 20) : 500;
  const row = await c.env.DB.prepare(
    `INSERT INTO request_limits (key, count, expires_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`,
  ).bind(digest, (window + 1) * windowSeconds).first<{ count: number }>();
  await c.env.DB.prepare(
    "DELETE FROM request_limits WHERE key IN (SELECT key FROM request_limits WHERE expires_at < ? LIMIT 100)",
  ).bind(now - windowSeconds).run();
  if (!row || row.count > limit) {
    c.header("Retry-After", String((window + 1) * windowSeconds - now));
    return c.json({ error: "Too many sign-in attempts. Please try again shortly." }, 429);
  }
  return next();
}
