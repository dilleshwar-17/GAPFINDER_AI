/**
 * Shared cookie name kept in a dependency-free module so that the proxy layer
 * can apply a cheap first-pass redirect without importing the database,
 * password hashing or session code.
 */
export const SESSION_COOKIE = "gf_session";
