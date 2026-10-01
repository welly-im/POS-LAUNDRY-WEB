import type { APIRoute } from "astro";
import { db, customers } from "../../../db";
import { eq, and } from "drizzle-orm";
import { normalizePhone } from "../../../lib/format";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { id, name, phone, address, note } = body;

    if (!id || !name || !phone) {
      return new Response(
        JSON.stringify({ error: "ID, Nama, dan No. HP wajib diisi" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const normPhone = normalizePhone(phone);

    const [updated] = await db
      .update(customers)
      .set({
        name: name.trim(),
        phone: normPhone,
        address: address ? address.trim() : null,
        note: note ? note.trim() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(customers.id, id), eq(customers.outletId, user.outletId)))
      .returning();

    return new Response(
      JSON.stringify({ success: true, customer: updated }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Update customer error:", err);
    return new Response(
      JSON.stringify({ error: "Gagal memperbarui data pelanggan" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
