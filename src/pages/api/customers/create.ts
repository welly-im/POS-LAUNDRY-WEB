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
    const name = String(body.name || "").trim();
    const rawPhone = String(body.phone || "").trim();
    const address = body.address ? String(body.address).trim() : null;
    const note = body.note ? String(body.note).trim() : null;

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ error: "Nama pelanggan wajib diisi (minimal 2 karakter)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!rawPhone || rawPhone.length < 7) {
      return new Response(
        JSON.stringify({ error: "Nomor WhatsApp/HP pelanggan wajib diisi" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const phone = normalizePhone(rawPhone);

    // Check duplicate
    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.outletId, user.outletId),
        eq(customers.phone, phone)
      ),
    });

    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          isDuplicate: true,
          customer: existing,
          message: `Pelanggan dengan nomor ${phone} sudah ada atas nama "${existing.name}". Menggunakan profil tersebut.`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const [newCustomer] = await db
      .insert(customers)
      .values({
        outletId: user.outletId,
        name,
        phone,
        address,
        note,
      })
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        isDuplicate: false,
        customer: newCustomer,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Create customer error:", err);
    return new Response(
      JSON.stringify({ error: "Gagal menyimpan data pelanggan baru" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
