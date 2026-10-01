import type { APIRoute } from "astro";
import { db, orders, payments, customers } from "../../../db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { formatRupiah, formatDateOnly } from "../../../lib/format";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const outlet = locals.outlet;
  if (!user || !outlet || user.role !== "owner") {
    return new Response(JSON.stringify({ error: "Unauthorized. Owner only." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "daily"; // 'daily' | 'monthly' | 'receivables'
  const dateStr = url.searchParams.get("date"); // YYYY-MM-DD or YYYY-MM

  try {
    let csvContent = "";
    let filename = `laporan_${type}_${Date.now()}.csv`;

    if (type === "receivables") {
      // Daftar Piutang
      filename = `daftar_piutang_${outlet.name.replace(/\s+/g, "_")}.csv`;
      const activeUnpaidOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.outletId, outlet.id),
          sql`${orders.status} != 'dibatalkan'`,
          sql`${orders.paidAmount} < ${orders.total}`
        ),
        with: {
          customer: true,
        },
        orderBy: (o, { asc }) => [asc(o.createdAt)],
      });

      csvContent = "No Invoice,Tanggal,Nama Pelanggan,No WhatsApp,Total Tagihan,Sudah Bayar,Sisa Piutang,Umur Piutang (Hari),Status Cucian\n";

      const nowTime = Date.now();
      for (const ord of activeUnpaidOrders) {
        const remaining = ord.total - ord.paidAmount;
        const daysAged = Math.floor((nowTime - new Date(ord.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        csvContent += `"${ord.invoiceNo}","${formatDateOnly(ord.createdAt)}","${ord.customer.name}","${ord.customer.phone}",${ord.total},${ord.paidAmount},${remaining},${daysAged},"${ord.status}"\n`;
      }
    } else if (type === "daily") {
      // Laporan Harian
      filename = `laporan_harian_${dateStr || "hari_ini"}.csv`;
      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const dayOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.outletId, outlet.id),
          gte(orders.createdAt, startOfDay),
          lte(orders.createdAt, endOfDay)
        ),
        with: {
          customer: true,
          creator: true,
        },
      });

      csvContent = "No Invoice,Waktu,Kasir,Pelanggan,Status,Total Omzet,Terbayar,Sisa Tagihan\n";
      for (const o of dayOrders) {
        const rem = o.total - o.paidAmount;
        csvContent += `"${o.invoiceNo}","${new Date(o.createdAt).toLocaleTimeString("id-ID")}","${o.creator?.fullName || "Kasir"}","${o.customer.name}","${o.status}",${o.total},${o.paidAmount},${rem}\n`;
      }
    } else {
      // Monthly
      filename = `laporan_bulanan_${dateStr || "bulan_ini"}.csv`;
      const allOrders = await db.query.orders.findMany({
        where: eq(orders.outletId, outlet.id),
        with: {
          customer: true,
          creator: true,
        },
      });

      csvContent = "No Invoice,Tanggal,Kasir,Pelanggan,Status,Total Omzet,Terbayar,Sisa Tagihan\n";
      for (const o of allOrders) {
        const rem = o.total - o.paidAmount;
        csvContent += `"${o.invoiceNo}","${formatDateOnly(o.createdAt)}","${o.creator?.fullName || "Kasir"}","${o.customer.name}","${o.status}",${o.total},${o.paidAmount},${rem}\n`;
      }
    }

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Export CSV error:", err);
    return new Response(JSON.stringify({ error: "Gagal mengekspor CSV" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
