import type { APIRoute } from "astro";
import {
  db,
  orders,
  payments,
  orderStatusLogs,
  auditLogs,
  shifts,
} from "../../../db";
import { eq, and, isNull } from "drizzle-orm";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const outlet = locals.outlet;
  if (!user || !outlet) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { orderId, reason, refundDecision, refundMethod = "tunai" } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Order ID wajib disertakan" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!reason || reason.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Alasan pembatalan wajib diisi minimal 5 karakter." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.outletId, outlet.id)),
      with: {
        payments: true,
      },
    });

    if (!order) {
      return new Response(
        JSON.stringify({ error: "Pesanan tidak ditemukan" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // FR-CAN-04: Order sudah_diambil cannot be cancelled
    if (order.status === "sudah_diambil") {
      return new Response(
        JSON.stringify({ error: "Pesanan yang sudah diambil pelanggan tidak dapat dibatalkan." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (order.status === "dibatalkan") {
      return new Response(
        JSON.stringify({ error: "Pesanan ini sudah dibatalkan sebelumnya." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Active shift of current cashier
    const activeShift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.cashierId, user.id),
        isNull(shifts.closedAt)
      ),
    });

    // Rule Section 11 #3: Kasir can only cancel order with status 'diterima' in the same shift
    if (user.role === "kasir") {
      if (order.status !== "diterima") {
        return new Response(
          JSON.stringify({
            error: "Kasir hanya dapat membatalkan pesanan yang berstatus 'Diterima'. Untuk pesanan dalam proses, hubungi Owner.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!activeShift || order.shiftId !== activeShift.id) {
        return new Response(
          JSON.stringify({
            error: "Kasir hanya dapat membatalkan pesanan yang dibuat pada shift yang sedang berjalan. Hubungi Owner untuk pembatalan shift sebelumnya.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Decision for DP refund if payments exist
    if (order.paidAmount > 0 && !refundDecision) {
      return new Response(
        JSON.stringify({
          error: `Pesanan ini memiliki pembayaran awal sebesar Rp ${order.paidAmount.toLocaleString("id-ID")}. Tentukan keputusan pengembalian (dikembalikan atau hangus).`,
          requiresRefundDecision: true,
          paidAmount: order.paidAmount,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      let isRefunded = false;

      if (order.paidAmount > 0 && refundDecision === "refund") {
        if (!activeShift) {
          throw new Error("Shift kasir harus aktif untuk memproses transaksi pengembalian uang (refund).");
        }

        // Record refund payment in shift
        await tx.insert(payments).values({
          orderId: order.id,
          shiftId: activeShift.id,
          kind: "refund",
          method: refundMethod,
          amount: order.paidAmount,
          note: `Pengembalian DP pembatalan order ${order.invoiceNo}: ${reason}`,
          createdBy: user.id,
        });

        isRefunded = true;
      }

      // Update order to cancelled
      await tx
        .update(orders)
        .set({
          status: "dibatalkan",
          cancelledAt: now,
          cancelledBy: user.id,
          cancelReason: reason,
          isRefunded,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));

      // Order status log
      await tx.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "dibatalkan",
        note: `Order dibatalkan. Alasan: ${reason}. Pengembalian DP: ${isRefunded ? "Dikembalikan" : "Hangus"}`,
        changedBy: user.id,
      });

      // Audit log
      await tx.insert(auditLogs).values({
        outletId: outlet.id,
        actorId: user.id,
        action: "BATALKAN_ORDER",
        entity: "orders",
        entityId: order.id,
        detail: `Invoice: ${order.invoiceNo}, Alasan: ${reason}, Refund: ${isRefunded ? "Ya" : "Tidak"}`,
      });
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Pesanan berhasil dibatalkan.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Cancel order error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Gagal membatalkan pesanan." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
