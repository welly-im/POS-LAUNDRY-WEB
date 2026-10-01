import { defineMiddleware } from "astro:middleware";
import { validateSession, SESSION_COOKIE_NAME } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    const authData = await validateSession(sessionId);
    if (authData) {
      context.locals.user = authData.user as any;
      context.locals.outlet = authData.outlet as any;
      context.locals.session = authData.session;
    } else {
      // Clear invalid session cookie
      context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
      context.locals.user = null;
      context.locals.outlet = null;
      context.locals.session = null;
    }
  } else {
    context.locals.user = null;
    context.locals.outlet = null;
    context.locals.session = null;
  }

  const { pathname } = context.url;
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname.startsWith("/logout") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/_astro") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest.json");

  // If user is accessing /login while already logged in
  if (pathname === "/login" && context.locals.user) {
    if (context.url.searchParams.get("logout") === "true") {
      context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
      context.locals.user = null;
      context.locals.outlet = null;
      context.locals.session = null;
      return next();
    }
    return context.redirect(context.locals.user.role === "owner" ? "/owner" : "/pos");
  }

  // Root redirect
  if (pathname === "/") {
    if (context.locals.user) {
      return context.redirect(context.locals.user.role === "owner" ? "/owner" : "/pos");
    }
    return context.redirect("/login");
  }

  // Protected route checking
  if (!isPublic) {
    if (!context.locals.user) {
      if (pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
    }

    // Role-specific check: /owner/* requires owner role
    if (pathname.startsWith("/owner") && context.locals.user.role !== "owner") {
      if (pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Forbidden. Owner only." }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
      return context.redirect("/pos?error=unauthorized_role");
    }
  }

  return next();
});
