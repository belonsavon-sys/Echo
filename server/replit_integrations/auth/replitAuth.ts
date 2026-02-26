import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { authStorage } from "./storage";
import { db } from "../../db";
import { budgets, favorites, netWorthAccounts, savingsGoals, tags } from "@shared/schema";

type AuthClaims = {
  sub: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
  exp?: number;
};

type AuthenticatedUser = {
  claims: AuthClaims;
  access_token: string;
  refresh_token: null;
  expires_at?: number;
};

const LEGACY_USER_ID = "local-dev-user";
const migratedLegacyOwners = new Set<string>();

type SupabaseAuthConfig = {
  url: string;
  audience: string;
  issuer: string;
};

let jwtKeySet: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwtKeySetIssuer: string | null = null;

function getSupabaseAuthConfig(): SupabaseAuthConfig {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const audience = process.env.SUPABASE_JWT_AUD || "authenticated";
  const issuer = url ? `${url}/auth/v1` : "";
  return { url, audience, issuer };
}

function getJwtKeySet(issuer: string) {
  if (!issuer) return null;
  if (jwtKeySet && jwtKeySetIssuer === issuer) return jwtKeySet;
  jwtKeySet = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  jwtKeySetIssuer = issuer;
  return jwtKeySet;
}

function isLocalDevAuthEnabled(): boolean {
  return process.env.LOCAL_DEV_AUTH === "true";
}

function getLocalDevClaims(): AuthClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: process.env.LOCAL_DEV_USER_ID || LEGACY_USER_ID,
    email: process.env.LOCAL_DEV_EMAIL || "local-dev@example.com",
    first_name: process.env.LOCAL_DEV_FIRST_NAME || "Local",
    last_name: process.env.LOCAL_DEV_LAST_NAME || "User",
    profile_image_url: process.env.LOCAL_DEV_AVATAR_URL || null,
    exp: now + 365 * 24 * 60 * 60,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.header("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
}

async function countRowsForUser(userId: string): Promise<number> {
  const [b] = await db.select({ c: sql<number>`count(*)` }).from(budgets).where(eq(budgets.userId, userId));
  const [t] = await db.select({ c: sql<number>`count(*)` }).from(tags).where(eq(tags.userId, userId));
  const [s] = await db.select({ c: sql<number>`count(*)` }).from(savingsGoals).where(eq(savingsGoals.userId, userId));
  const [f] = await db.select({ c: sql<number>`count(*)` }).from(favorites).where(eq(favorites.userId, userId));
  const [n] = await db.select({ c: sql<number>`count(*)` }).from(netWorthAccounts).where(eq(netWorthAccounts.userId, userId));
  return Number(b.c || 0) + Number(t.c || 0) + Number(s.c || 0) + Number(f.c || 0) + Number(n.c || 0);
}

async function countLegacyRows(): Promise<number> {
  const legacy = (value: any) => or(eq(value, LEGACY_USER_ID), isNull(value));
  const [b] = await db.select({ c: sql<number>`count(*)` }).from(budgets).where(legacy(budgets.userId));
  const [t] = await db.select({ c: sql<number>`count(*)` }).from(tags).where(legacy(tags.userId));
  const [s] = await db.select({ c: sql<number>`count(*)` }).from(savingsGoals).where(legacy(savingsGoals.userId));
  const [f] = await db.select({ c: sql<number>`count(*)` }).from(favorites).where(legacy(favorites.userId));
  const [n] = await db.select({ c: sql<number>`count(*)` }).from(netWorthAccounts).where(legacy(netWorthAccounts.userId));
  return Number(b.c || 0) + Number(t.c || 0) + Number(s.c || 0) + Number(f.c || 0) + Number(n.c || 0);
}

async function migrateLegacyDataToUser(userId: string) {
  if (migratedLegacyOwners.has(userId)) return;

  const ownedCount = await countRowsForUser(userId);
  const legacyCountBefore = await countLegacyRows();

  if (ownedCount > 0 || legacyCountBefore === 0) {
    migratedLegacyOwners.add(userId);
    return;
  }

  const legacy = (value: any) => or(eq(value, LEGACY_USER_ID), isNull(value));

  await db.transaction(async (tx) => {
    await tx.update(budgets).set({ userId }).where(legacy(budgets.userId));
    await tx.update(tags).set({ userId }).where(legacy(tags.userId));
    await tx.update(savingsGoals).set({ userId }).where(legacy(savingsGoals.userId));
    await tx.update(favorites).set({ userId }).where(legacy(favorites.userId));
    await tx.update(netWorthAccounts).set({ userId }).where(legacy(netWorthAccounts.userId));
  });

  const ownedCountAfter = await countRowsForUser(userId);
  const legacyCountAfter = await countLegacyRows();

  console.info("[auth-migration]", {
    event: "legacy_owner_backfill",
    userId,
    ownedCountBefore: ownedCount,
    ownedCountAfter,
    legacyCountBefore,
    legacyCountAfter,
    migratedAt: new Date().toISOString(),
  });

  migratedLegacyOwners.add(userId);
}

async function claimsFromToken(token: string): Promise<AuthClaims> {
  const { issuer, audience } = getSupabaseAuthConfig();
  const keySet = getJwtKeySet(issuer);
  if (!keySet || !issuer) {
    throw new Error("SUPABASE_URL must be configured for auth verification");
  }

  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience,
  });

  const userMetadata =
    payload.user_metadata && typeof payload.user_metadata === "object"
      ? (payload.user_metadata as Record<string, unknown>)
      : {};

  return {
    sub: asString(payload.sub) || "",
    email: asString(payload.email),
    first_name: asString(userMetadata.first_name) || asString(userMetadata.given_name),
    last_name: asString(userMetadata.last_name) || asString(userMetadata.family_name),
    profile_image_url:
      asString(payload.picture) ||
      asString(userMetadata.avatar_url) ||
      asString(userMetadata.profile_image_url),
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
  };
}

async function attachAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  if (isLocalDevAuthEnabled()) {
    const claims = getLocalDevClaims();
    const user: AuthenticatedUser = {
      claims,
      access_token: "local-dev-token",
      refresh_token: null,
      expires_at: claims.exp,
    };
    (req as any).user = user;
    (req as any).isAuthenticated = () => true;
    await authStorage.upsertUser({
      id: claims.sub,
      email: claims.email,
      firstName: claims.first_name,
      lastName: claims.last_name,
      profileImageUrl: claims.profile_image_url,
    });
    return user;
  }

  const token = getBearerToken(req);
  if (!token) return null;

  const claims = await claimsFromToken(token);
  if (!claims.sub) return null;

  const user: AuthenticatedUser = {
    claims,
    access_token: token,
    refresh_token: null,
    expires_at: claims.exp,
  };

  (req as any).user = user;
  (req as any).isAuthenticated = () => true;

  await authStorage.upsertUser({
    id: claims.sub,
    email: claims.email,
    firstName: claims.first_name,
    lastName: claims.last_name,
    profileImageUrl: claims.profile_image_url,
  });

  await migrateLegacyDataToUser(claims.sub);
  return user;
}

export async function setupAuth(_app: Express) {
  const { url } = getSupabaseAuthConfig();
  if (!isLocalDevAuthEnabled() && !url) {
    throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) must be set for authentication.");
  }
}

export function getSession() {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const user = await attachAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return next();
  } catch (error) {
    const status = (error as any)?.code === "ERR_JWT_EXPIRED" ? 401 : 401;
    return res.status(status).json({ message: "Unauthorized" });
  }
};
