import type { Request } from "express";

type AuthClaims = {
  sub: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
};

type RequestUser = {
  claims: AuthClaims;
};

export type AuthenticatedRequest = Request & {
  user: RequestUser;
  isAuthenticated?: () => boolean;
};

export function getAuthenticatedRequestUser(req: Request): RequestUser {
  const user = (req as Partial<AuthenticatedRequest>).user;
  const userId = user?.claims?.sub;
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Missing authenticated user id");
  }
  return user as RequestUser;
}

export function getAuthenticatedUserId(req: Request): string {
  return getAuthenticatedRequestUser(req).claims.sub;
}
