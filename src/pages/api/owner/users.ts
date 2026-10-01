import type { APIRoute } from "astro";
import { db, users } from "../../../db";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../../../lib/auth";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const outlet = locals.outlet;
  if (!user || !outlet || user.role !== "owner") {
    return new Response(JSON.stringify({ error: "Unauthorized. Owner only." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { action, id, username, email, fullName, password, role, pin, isActive } = body;

    if (action === "create") {
      if (!username || !fullName || !password) {
        return new Response(JSON.stringify({ error: "Username, Nama Lengkap, dan Password wajib diisi" }), { status: 400 });
      }

      // Check existing username in this outlet
      const existing = await db.query.users.findFirst({
        where: and(eq(users.outletId, outlet.id), eq(users.username, username.trim())),
      });
      if (existing) {
        return new Response(JSON.stringify({ error: "Username sudah digunakan." }), { status: 400 });
      }

      const passwordHash = await hashPassword(password);
      const [newUser] = await db
        .insert(users)
        .values({
          outletId: outlet.id,
          username: username.trim(),
          email: email ? email.trim() : null,
          fullName: fullName.trim(),
          passwordHash,
          role: role === "owner" ? "owner" : "kasir",
          pin: pin ? String(pin).trim() : null,
          isActive: true,
        })
        .returning();

      return new Response(JSON.stringify({ success: true, user: newUser }), { status: 201 });
    }

    if (action === "update_status") {
      const [u] = await db
        .update(users)
        .set({
          isActive: Boolean(isActive),
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, id), eq(users.outletId, outlet.id)))
        .returning();

      return new Response(JSON.stringify({ success: true, user: u }), { status: 200 });
    }

    if (action === "reset_password") {
      if (!password || password.length < 5) {
        return new Response(JSON.stringify({ error: "Password baru minimal 5 karakter" }), { status: 400 });
      }

      const passwordHash = await hashPassword(password);
      await db
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, id), eq(users.outletId, outlet.id)));

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Aksi tidak dikenali" }), { status: 400 });
  } catch (err: any) {
    console.error("Owner users error:", err);
    return new Response(JSON.stringify({ error: "Gagal memproses data karyawan" }), { status: 500 });
  }
};
