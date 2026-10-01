import type { APIRoute } from "astro";
import { db, shifts, auditLogs } from "../../../db";
import { eq, and, isNull } from "drizzle-orm";

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
    const openingCash = Math.round(Number(body.openingCash));

    if (isNaN(openingCash) || openingCash < 0) {
      return new Response(
        JSON.stringify({ error: "Kas awal harus berupa angka valid (minimal Rp 0)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if cashier already has an open shift
    const existing = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.cashierId, user.id),
        isNull(shifts.closedAt)
      ),
    });

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Anda masih memiliki shift yang belum ditutup." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create shift
    const [newShift] = await db
      .insert(shifts)
      .values({
        outletId: user.outletId,
        cashierId: user.id,
        openingCash,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      outletId: user.outletId,
      actorId: user.id,
      action: "BUKA_SHIFT",
      entity: "shifts",
      entityId: newShift.id,
      detail: `Kas awal: Rp ${openingCash.toLocaleString("id-ID")}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        shift: newShift,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error opening shift:", error);
    return new Response(
      JSON.stringify({ error: "Gagal membuka shift kasir" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
