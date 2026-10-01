import type { APIRoute } from "astro";
import { db, shifts, payments, auditLogs, orders } from "../../../db";
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
    const countedCash = Math.round(Number(body.countedCash));
    const closingNote = body.closingNote ? String(body.closingNote).trim() : "";

    if (isNaN(countedCash) || countedCash < 0) {
      return new Response(
        JSON.stringify({ error: "Uang fisik di laci harus berupa angka valid (minimal Rp 0)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find active shift
    const activeShift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.cashierId, user.id),
        isNull(shifts.closedAt)
      ),
      with: {
        cashier: true,
        outlet: true,
      },
    });

    if (!activeShift) {
      return new Response(
        JSON.stringify({ error: "Tidak ada shift aktif yang ditemukan." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Compute expected cash
    const shiftPayments = await db.query.payments.findMany({
      where: eq(payments.shiftId, activeShift.id),
    });

    let cashIn = 0;
    let cashRefund = 0;
    let qrisIn = 0;

    for (const p of shiftPayments) {
      if (p.method === "tunai") {
        if (p.kind === "refund") {
          cashRefund += p.amount;
        } else {
          cashIn += p.amount;
        }
      } else if (p.method === "qris") {
        if (p.kind === "refund") {
          qrisIn -= p.amount;
        } else {
          qrisIn += p.amount;
        }
      }
    }

    const expectedCash = activeShift.openingCash + cashIn - cashRefund;
    const cashDifference = countedCash - expectedCash;

    // FR-SHF-03: Kasir memasukkan uang fisik hasil hitung; sistem menghitung selisih dan mewajibkan catatan bila selisih ≠ 0.
    if (cashDifference !== 0 && !closingNote) {
      return new Response(
        JSON.stringify({
          error: `Terdapat selisih kas sebesar Rp ${Math.abs(cashDifference).toLocaleString("id-ID")}. Catatan penutupan shift wajib diisi untuk menjelaskan alasan selisih.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const now = new Date();

    // Update shift to closed
    const [closedShift] = await db
      .update(shifts)
      .set({
        closedAt: now,
        countedCash,
        expectedCash,
        cashDifference,
        closingNote: closingNote || null,
      })
      .where(eq(shifts.id, activeShift.id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      outletId: user.outletId,
      actorId: user.id,
      action: "TUTUP_SHIFT",
      entity: "shifts",
      entityId: closedShift.id,
      detail: `Kas dihitung: Rp ${countedCash.toLocaleString("id-ID")}, Seharusnya: Rp ${expectedCash.toLocaleString("id-ID")}, Selisih: Rp ${cashDifference.toLocaleString("id-ID")}`,
    });

    const shiftOrders = await db.query.orders.findMany({
      where: eq(orders.shiftId, activeShift.id),
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          id: closedShift.id,
          outletName: activeShift.outlet.name,
          cashierName: activeShift.cashier.fullName,
          openedAt: activeShift.openedAt,
          closedAt: now,
          openingCash: activeShift.openingCash,
          cashIn,
          cashRefund,
          expectedCash,
          countedCash,
          cashDifference,
          qrisIn,
          totalRealIncome: (cashIn - cashRefund) + qrisIn,
          orderCount: shiftOrders.length,
          closingNote: closingNote || "-",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error closing shift:", error);
    return new Response(
      JSON.stringify({ error: "Gagal menutup shift kasir" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
