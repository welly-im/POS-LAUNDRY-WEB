import type { APIRoute } from "astro";
import {
  db,
  orders,
  orderStatusLogs,
  payments,
  shifts,
  auditLogs,
} from "../../../db";
import { eq, and, isNull } from "drizzle-orm";

const VALID_STATUSES = ["diterima", "diproses", "selesai", "sudah_diambil"] as const;

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
    const {
      orderId,
      newStatus,
      newEstimatedDoneAt,
      paymentKind, // 'pelunasan'
      paymentMethod, // 'tunai' | 'qris'
      paymentAmount,
      cashReceived,
      paymentReference,
      ownerOverrideReason,
    } = body;

    if (!orderId || (!newStatus && !newEstimatedDoneAt)) {
      return new Response(
        JSON.stringify({ error: "Order ID dan Status baru atau Estimasi Selesai wajib disertakan" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.outletId, outlet.id)),
      with: {
        customer: true,
        items: true,
        payments: true,
        creator: true,
      },
    });

    if (!order) {
      return new Response(
        JSON.stringify({ error: "Pesanan tidak ditemukan" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (order.status === "dibatalkan") {
      return new Response(
        JSON.stringify({ error: "Pesanan yang sudah dibatalkan tidak dapat diubah statusnya." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check active shift for payments
    const activeShift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.cashierId, user.id),
        isNull(shifts.closedAt)
      ),
    });

    // Check payment if transitioning to sudah_diambil (FR-PAY-05)
    const remaining = order.total - order.paidAmount;
    if (newStatus === "sudah_diambil" && remaining > 0) {
      if (!paymentAmount && !ownerOverrideReason) {
        return new Response(
          JSON.stringify({
            error: `Cucian belum lunas (sisa ${remaining.toLocaleString("id-ID")}). Pelunasan wajib diselesaikan sebelum pengambilan, atau minta persetujuan Owner.`,
            requiresSettlement: true,
            remaining,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (ownerOverrideReason && user.role !== "owner") {
        return new Response(
          JSON.stringify({
            error: "Hanya Owner yang dapat mengizinkan pengambilan cucian tanpa pelunasan penuh.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Execute atomic update
    const updated = await db.transaction(async (tx) => {
      let additionalPaid = 0;
      let newPayment = null;

      // Handle settlement payment if supplied
      if (paymentAmount && Number(paymentAmount) > 0) {
        if (!activeShift) {
          throw new Error("Shift kasir belum dibuka. Anda harus memiliki shift aktif untuk menerima pelunasan.");
        }

        const payVal = Math.min(Number(paymentAmount), remaining);
        additionalPaid = payVal;

        const cashRec =
          paymentMethod === "tunai"
            ? Math.max(payVal, Number(cashReceived) || payVal)
            : null;
        const change =
          paymentMethod === "tunai" && cashRec ? Math.max(0, cashRec - payVal) : 0;

        const [pRecord] = await tx
          .insert(payments)
          .values({
            orderId: order.id,
            shiftId: activeShift.id,
            kind: "pelunasan",
            method: paymentMethod || "tunai",
            amount: payVal,
            cashReceived: cashRec,
            changeGiven: change,
            reference: paymentMethod === "qris" ? paymentReference : null,
            note: "Pelunasan sisa tagihan saat pengambilan cucian",
            createdBy: user.id,
          })
          .returning();

        newPayment = pRecord;
      }

      // Update Order
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (newStatus) {
        updateData.status = newStatus;
      }

      if (newEstimatedDoneAt) {
        updateData.estimatedDoneAt = new Date(newEstimatedDoneAt);
      }

      if (additionalPaid > 0) {
        updateData.paidAmount = order.paidAmount + additionalPaid;
      }

      if (newStatus === "sudah_diambil") {
        updateData.pickedUpAt = new Date();
      }

      const [updatedOrder] = await tx
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, order.id))
        .returning();

      // Log status change if status changed
      if (newStatus && newStatus !== order.status) {
        await tx.insert(orderStatusLogs).values({
          orderId: order.id,
          fromStatus: order.status,
          toStatus: newStatus,
          note: ownerOverrideReason
            ? `Status diubah ke ${newStatus}. Override Owner: ${ownerOverrideReason}`
            : `Status diubah ke ${newStatus}`,
          changedBy: user.id,
        });
      } else if (newEstimatedDoneAt) {
        await tx.insert(orderStatusLogs).values({
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          note: `Estimasi selesai disesuaikan menjadi ${new Date(newEstimatedDoneAt).toLocaleString("id-ID")}`,
          changedBy: user.id,
        });
      }

      return {
        order: updatedOrder,
        payment: newPayment,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        order: updated.order,
        payment: updated.payment,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Update status error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Gagal memperbarui status order." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
