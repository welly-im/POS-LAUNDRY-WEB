import type { APIRoute } from "astro";
import { destroySession, SESSION_COOKIE_NAME } from "../../../lib/auth";

export const ALL: APIRoute = async ({ cookies, request }) => {
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    try {
      await destroySession(sessionId);
    } catch (e) {
      console.error("Error destroying session in DB:", e);
    }
  }

  // Clear cookie via Astro cookie manager
  cookies.delete(SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  const cookieHeader = `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`;

  const acceptHeader = request.headers.get("accept") || "";
  const isFetch =
    request.headers.get("x-requested-with") === "fetch" ||
    acceptHeader.includes("application/json") ||
    request.headers.get("content-type")?.includes("application/json");

  if (request.method === "GET" || !isFetch) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/login?logout=true",
        "Set-Cookie": cookieHeader,
      },
    });
  }

  return new Response(JSON.stringify({ success: true, redirect: "/login?logout=true" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader,
    },
  });
};

export const POST = ALL;
export const GET = ALL;
