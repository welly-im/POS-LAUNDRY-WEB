import type { APIRoute } from "astro";
import { db, users } from "../../../db";
import { eq, or, and } from "drizzle-orm";
import { verifyPassword, createSession, SESSION_COOKIE_NAME } from "../../../lib/auth";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { usernameOrEmail, password } = body;

    if (!usernameOrEmail || !password) {
      return new Response(
        JSON.stringify({ error: "Username/Email dan Password wajib diisi" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const input = String(usernameOrEmail).trim();

    // Find user by username or email
    const user = await db.query.users.findFirst({
      where: or(eq(users.username, input), eq(users.email, input)),
      with: {
        outlet: true,
      },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Akun tidak ditemukan. Periksa kembali username/email Anda." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!user.isActive) {
      return new Response(
        JSON.stringify({ error: "Akun ini telah dinonaktifkan. Hubungi pemilik usaha." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return new Response(
        JSON.stringify({ error: "Password salah. Silakan coba lagi." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create session
    const sessionId = await createSession(user.id);

    // Set cookie (valid for 30 days)
    cookies.set(SESSION_COOKIE_NAME, sessionId, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const redirectUrl = user.role === "owner" ? "/owner" : "/pos";

    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ error: "Terjadi kesalahan pada server saat login" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
