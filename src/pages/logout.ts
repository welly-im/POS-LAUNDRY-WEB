import type { APIRoute } from "astro";
import { destroySession, SESSION_COOKIE_NAME } from "../lib/auth";

export const ALL: APIRoute = async ({ cookies, request }) => {
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    try {
      await destroySession(sessionId);
    } catch (e) {
      console.error("Error destroying session in DB:", e);
    }
  }

  cookies.delete(SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  const cookieHeader = `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login?logout=true",
      "Set-Cookie": cookieHeader,
    },
  });
};

export const GET = ALL;
export const POST = ALL;
