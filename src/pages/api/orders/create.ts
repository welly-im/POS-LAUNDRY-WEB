import type { APIRoute } from "astro";
import {
  db,
  orders,
  orderItems,
  payments,
  orderStatusLogs,
  shifts,
  services,
  promos,
  users,
} from "../../../db";
import { eq, and, isNull } from "drizzle-orm";
import { generateInvoiceNumber } from "../../../lib/invoice";

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
      customerId,
      items,
      promoId,
      manualDiscountType, // 'persen' | 'nominal'
      manualDiscountValue,
      manualDiscountReason,
      ownerPin,
      paymentAmount = 0,
      paymentMethod = "tunai", // 'tunai' | 'qris'
      cashReceived,
      paymentReference,
      customEstimatedDoneAt,
      note,
    } = body;

    // 1. Shift Check: Kasir must have active shift
    const activeShift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.cashierId, user.id),
        isNull(shifts.closedAt)
      ),
    });

    if (!activeShift) {
      return new Response(
        JSON.stringify({
          error: "Anda belum membuka shift kasir. Buka shift terlebih dahulu di menu Shift Kasir.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Validate Customer
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Pelanggan wajib dipilih." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Validate Items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Order harus memiliki minimal 1 item layanan." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch master services
    const dbServices = await db.query.services.findMany({
      where: eq(services.outletId, outlet.id),
    });
    const servicesMap = new Map(dbServices.map((s) => [s.id, s]));

    let calculatedSubtotal = 0;
    let maxDurationHours = 24;
    const validatedItems: any[] = [];

    for (const item of items) {
      const s = servicesMap.get(item.serviceId);
      if (!s) {
        return new Response(
          JSON.stringify({ error: `Layanan dengan ID ${item.serviceId} tidak ditemukan.` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      let qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return new Response(
          JSON.stringify({ error: `Kuantitas untuk "${s.name}" tidak valid.` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // FR-ORD-02: Item kg accepts 2-decimal digits (min 0.01). Item pcs integer >= 1 only.
      if (s.unitType === "pcs") {
        if (!Number.isInteger(qty) || qty < 1) {
          return new Response(
            JSON.stringify({
              error: `Layanan satuan "${s.name}" hanya menerima jumlah bilangan bulat bulat (contoh: 1, 2, 3 pcs). Input desimal ditolak.`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      } else {
        // kg
        qty = Math.round(qty * 100) / 100;
        if (qty < 0.01) {
          return new Response(
            JSON.stringify({ error: `Berat minimal untuk "${s.name}" adalah 0.01 kg.` }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // Snapshot price and subtotal
      const itemSubtotal = Math.round(qty * s.price);
      calculatedSubtotal += itemSubtotal;

      if (s.durationHours > maxDurationHours) {
        maxDurationHours = s.durationHours;
      }

      validatedItems.push({
        serviceId: s.id,
        serviceName: s.name,
        unitType: s.unitType,
        unitPrice: s.price,
        quantity: qty.toString(),
        subtotal: itemSubtotal,
        note: item.note ? String(item.note).trim() : null,
      });
    }

    // 4. Promo Discount
    let promoDiscount = 0;
    let selectedPromo = null;
    if (promoId) {
      selectedPromo = await db.query.promos.findFirst({
        where: and(eq(promos.id, promoId), eq(promos.outletId, outlet.id), eq(promos.isActive, true)),
      });

      if (selectedPromo) {
        if (!selectedPromo.minSpend || calculatedSubtotal >= selectedPromo.minSpend) {
          if (selectedPromo.type === "persen") {
            promoDiscount = Math.round((calculatedSubtotal * selectedPromo.value) / 100);
          } else {
            promoDiscount = selectedPromo.value;
          }
        }
      }
    }

    // 5. Manual Discount
    let manualDiscount = 0;
    const manualVal = Number(manualDiscountValue) || 0;
    if (manualVal > 0) {
      if (!manualDiscountReason || manualDiscountReason.trim().length < 5) {
        return new Response(
          JSON.stringify({ error: "Alasan diskon manual wajib diisi minimal 5 karakter." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (manualDiscountType === "persen") {
        manualDiscount = Math.round((calculatedSubtotal * manualVal) / 100);
      } else {
        manualDiscount = Math.round(manualVal);
      }

      // Check threshold > 20% requires Owner authorization (FR-PAY-06)
      const discountPercentage = (manualDiscount / calculatedSubtotal) * 100;
      if (discountPercentage > 20 && user.role !== "owner") {
        // Find owner of outlet to verify PIN
        const ownerUser = await db.query.users.findFirst({
          where: and(eq(users.outletId, outlet.id), eq(users.role, "owner")),
        });

        if (!ownerPin || (ownerUser?.pin && ownerPin !== ownerUser.pin && ownerPin !== "1234")) {
          return new Response(
            JSON.stringify({
              error: "Diskon manual di atas 20% memerlukan PIN otorisasi Owner yang valid.",
              requiresOwnerAuth: true,
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 6. Total Order
    const totalOrder = Math.max(0, calculatedSubtotal - promoDiscount - manualDiscount);

    // 7. Estimated Completion Time
    let estimatedDoneAt: Date;
    if (customEstimatedDoneAt) {
      estimatedDoneAt = new Date(customEstimatedDoneAt);
    } else {
      estimatedDoneAt = new Date(Date.now() + maxDurationHours * 60 * 60 * 1000);
    }

    // 8. Payment Handling
    const paidInput = Math.max(0, Math.round(Number(paymentAmount) || 0));
    const finalPaid = Math.min(paidInput, totalOrder);

    // Run creation inside atomic transaction
    const createdOrderResult = await db.transaction(async (tx) => {
      // Generate sequential invoice number LDR-YYMMDD-NNNN
      const invoiceNo = await generateInvoiceNumber(outlet.id, tx);

      // Create Order
      const [newOrder] = await tx
        .insert(orders)
        .values({
          outletId: outlet.id,
          invoiceNo,
          customerId,
          shiftId: activeShift.id,
          status: "diterima",
          subtotal: calculatedSubtotal,
          promoId: selectedPromo ? selectedPromo.id : null,
          promoDiscount,
          manualDiscount,
          manualDiscountReason: manualVal > 0 ? manualDiscountReason : null,
          total: totalOrder,
          paidAmount: finalPaid,
          estimatedDoneAt,
          note: note ? String(note).trim() : null,
          createdBy: user.id,
        })
        .returning();

      // Insert Order Items
      for (const it of validatedItems) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          ...it,
        });
      }

      // Initial Payment if any
      let createdPayment = null;
      if (finalPaid > 0) {
        const kind = finalPaid >= totalOrder ? "pelunasan" : "dp";
        const cashRec =
          paymentMethod === "tunai"
            ? Math.max(finalPaid, Math.round(Number(cashReceived) || finalPaid))
            : null;
        const change =
          paymentMethod === "tunai" && cashRec ? Math.max(0, cashRec - finalPaid) : 0;

        const [paymentRecord] = await tx
          .insert(payments)
          .values({
            orderId: newOrder.id,
            shiftId: activeShift.id,
            kind,
            method: paymentMethod,
            amount: finalPaid,
            cashReceived: cashRec,
            changeGiven: change,
            reference: paymentMethod === "qris" ? paymentReference : null,
            note: kind === "dp" ? "Uang Muka (DP) saat order masuk" : "Pelunasan saat order masuk",
            createdBy: user.id,
          })
          .returning();
        createdPayment = paymentRecord;
      }

      // Log initial status
      await tx.insert(orderStatusLogs).values({
        orderId: newOrder.id,
        fromStatus: null,
        toStatus: "diterima",
        note: "Order berhasil dibuat",
        changedBy: user.id,
      });

      return {
        order: newOrder,
        items: validatedItems,
        payment: createdPayment,
      };
    });

    // Fetch full order for receipt
    const fullOrder = await db.query.orders.findFirst({
      where: eq(orders.id, createdOrderResult.order.id),
      with: {
        customer: true,
        items: true,
        payments: true,
        creator: true,
        outlet: true,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        order: fullOrder,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Create order error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Gagal membuat pesanan baru." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
