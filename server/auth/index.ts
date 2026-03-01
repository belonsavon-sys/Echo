export { setupAuth, isAuthenticated, getSession } from "./supabaseAuth";
export { authStorage, type IAuthStorage } from "./storage";
export { registerAuthRoutes } from "./routes";
export { getAuthenticatedRequestUser, getAuthenticatedUserId, type AuthenticatedRequest } from "./request";
