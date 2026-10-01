import type { APIRoute } from "astro";
import { db, shifts, payments, orders } from "../../../db";
import { eq, and, isNull, sql } from "drizzle-orm";

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Find active shift for cashier (or any active shift if owner)
    const activeShift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.cashierId, user.id),
        isNull(shifts.closedAt)
      ),
      with: {
        cashier: true,
      },
    });

    if (!activeShift) {
      return new Response(JSON.stringify({ activeShift: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate shift stats
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
          // qris refund
          qrisIn -= p.amount;
        } else {
          qrisIn += p.amount;
        }
      }
    }

    const expectedCash = activeShift.openingCash + cashIn - cashRefund;
    const totalRealIncome = (cashIn - cashRefund) + qrisIn;

    // Shift orders count
    const shiftOrders = await db.query.orders.findMany({
      where: eq(orders.shiftId, activeShift.id),
    });

    // Total outstanding receivables (piutang aktif) across outlet
    const activeOrdersWithReceivables = await db.query.orders.findMany({
      where: and(
        eq(orders.outletId, user.outletId),
        sql`${orders.status} != 'dibatalkan'`,
        sql`${orders.paidAmount} < ${orders.total}`
      ),
    });

    let totalPiutang = 0;
    for (const o of activeOrdersWithReceivables) {
      totalPiutang += (o.total - o.paidAmount);
    }

    return new Response(
      JSON.stringify({
        activeShift: {
          id: activeShift.id,
          cashierId: activeShift.cashierId,
          cashierName: activeShift.cashier.fullName,
          openedAt: activeShift.openedAt,
          openingCash: activeShift.openingCash,
          cashIn,
          cashRefund,
          expectedCash,
          qrisIn,
          totalRealIncome,
          orderCount: shiftOrders.length,
          totalPiutang,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error fetching current shift:", error);
    return new Response(
      JSON.stringify({ error: "Gagal mengambil data shift" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
