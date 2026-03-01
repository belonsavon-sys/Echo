import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./supabaseAuth";
import { getAuthenticatedRequestUser } from "./request";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const authUser = getAuthenticatedRequestUser(req);
      const userId = authUser.claims.sub;
      const dbUser = await authStorage.getUser(userId);
      if (dbUser) return res.json(dbUser);
      return res.json({
        id: userId,
        email: authUser.claims.email || null,
        firstName: authUser.claims.first_name || null,
        lastName: authUser.claims.last_name || null,
        profileImageUrl: authUser.claims.profile_image_url || null,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
