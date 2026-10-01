import React, { useState } from "react";
import { formatRupiah, formatDate, formatDateOnly, generateWhatsAppUrl, buildBillingWhatsAppMessage } from "../lib/format";
import {
  TrendingUp,
  DollarSign,
  AlertCircle,
  Clock,
  Download,
  Calendar,
  MessageCircle,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  PieChart
} from "lucide-react";

interface DailySummary {
  date: string;
  totalOmzet: number;
  cashIncome: number;
  qrisIncome: number;
  totalRealIncome: number;
  orderCount: number;
  newReceivables: number;
}

interface MonthlySummary {
  monthName: string;
  totalOmzet: number;
  cashIncome: number;
  qrisIncome: number;
  totalRealIncome: number;
  orderCount: number;
  avgOrderValue: number;
  cancelledCount: number;
  serviceBreakdown: Array<{
    serviceName: string;
    unitType: string;
    totalQty: number;
    totalAmount: number;
  }>;
  cashierBreakdown: Array<{
    cashierName: string;
    orderCount: number;
    totalOmzet: number;
  }>;
}

interface ReceivableItem {
  id: string;
  invoiceNo: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paidAmount: number;
  remaining: number;
  daysAged: number;
  status: string;
}

interface OwnerDashboardProps {
  metrics: {
    todayOmzet: number;
    todayRealIncome: number;
    todayCash: number;
    todayQris: number;
    totalActivePiutang: number;
    activeOrdersCount: number;
  };
  dailySummary: DailySummary;
  monthlySummary: MonthlySummary;
  receivables: ReceivableItem[];
  outletName: string;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  metrics,
  dailySummary,
  monthlySummary,
  receivables,
  outletName,
}) => {
  const [activeTab, setActiveTab] = useState<"daily" | "monthly" | "receivables">("daily");

  return (
    <div className="space-y-6">
      {/* 1. Executive Top Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Omzet Hari Ini</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {formatRupiah(metrics.todayOmzet)}
          </div>
          <span className="text-[11px] text-slate-400 block">
            Nilai order baru dibuat hari ini
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pendapatan Riil Hari Ini</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600">
            {formatRupiah(metrics.todayRealIncome)}
          </div>
          <div className="text-[10px] text-slate-500 flex gap-2">
            <span>Tunai: {formatRupiah(metrics.todayCash)}</span>
            <span>&bull;</span>
            <span>QRIS: {formatRupiah(metrics.todayQris)}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Piutang Aktif</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-extrabold text-rose-600">
            {formatRupiah(metrics.totalActivePiutang)}
          </div>
          <span className="text-[11px] text-slate-400 block">
            {receivables.length} pelanggan belum lunas
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pesanan Aktif</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {metrics.activeOrdersCount}
          </div>
          <span className="text-[11px] text-slate-400 block">
            Status Diterima / Proses / Siap
          </span>
        </div>
      </div>

      {/* 2. Tabs Selector & CSV Export */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`py-2 px-3.5 rounded-xl font-semibold cursor-pointer transition-colors ${
              activeTab === "daily"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Laporan Harian
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={`py-2 px-3.5 rounded-xl font-semibold cursor-pointer transition-colors ${
              activeTab === "monthly"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Laporan Bulanan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("receivables")}
            className={`py-2 px-3.5 rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === "receivables"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>Daftar Piutang</span>
            {receivables.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "receivables" ? "bg-white text-blue-700" : "bg-rose-100 text-rose-700"
              }`}>
                {receivables.length}
              </span>
            )}
          </button>
        </div>

        {/* CSV Export Button */}
        <a
          href={`/api/owner/export-csv?type=${activeTab}`}
          className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Ekspor CSV ({activeTab.toUpperCase()})
        </a>
      </div>

      {/* 3. TAB 1: LAPORAN HARIAN */}
      {activeTab === "daily" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Rekap Kas & Omzet Harian</h3>
              <p className="text-xs text-slate-500">
                Data transaksi untuk hari ini ({formatDateOnly(new Date())})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Omzet Order Dibuat</span>
              <span className="text-lg font-bold text-slate-900 block">
                {formatRupiah(dailySummary.totalOmzet)}
              </span>
              <span className="text-[11px] text-slate-400">
                {dailySummary.orderCount} order baru
              </span>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1">
              <span className="text-xs text-emerald-800 font-medium">Pendapatan Riil (Tunai + QRIS)</span>
              <span className="text-lg font-bold text-emerald-900 block">
                {formatRupiah(dailySummary.totalRealIncome)}
              </span>
              <span className="text-[11px] text-emerald-700">
                Tunai: {formatRupiah(dailySummary.cashIncome)} &bull; QRIS: {formatRupiah(dailySummary.qrisIncome)}
              </span>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100 space-y-1">
              <span className="text-xs text-amber-800 font-medium">Piutang Baru Hari Ini</span>
              <span className="text-lg font-bold text-amber-900 block">
                {formatRupiah(dailySummary.newReceivables)}
              </span>
              <span className="text-[11px] text-amber-700">
                Tagihan order hari ini yang belum terbayar
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: LAPORAN BULANAN */}
      {activeTab === "monthly" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Laporan Performa Usaha Bulanan ({monthlySummary.monthName})
              </h3>
              <p className="text-xs text-slate-500">
                Rekap akumulasi omzet, rata-rata order, breakdown per layanan, dan per kasir
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Total Omzet Bulan Ini</span>
              <span className="text-lg font-bold text-slate-900">
                {formatRupiah(monthlySummary.totalOmzet)}
              </span>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-700 block mb-1">Uang Riil Masuk</span>
              <span className="text-lg font-bold text-emerald-800">
                {formatRupiah(monthlySummary.totalRealIncome)}
              </span>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-xs text-blue-700 block mb-1">Rata-rata per Order</span>
              <span className="text-lg font-bold text-blue-800">
                {formatRupiah(monthlySummary.avgOrderValue)}
              </span>
            </div>
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
              <span className="text-xs text-rose-700 block mb-1">Order Dibatalkan</span>
              <span className="text-lg font-bold text-rose-800">
                {monthlySummary.cancelledCount} Order
              </span>
            </div>
          </div>

          {/* Breakdown per Service & per Cashier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Service breakdown */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-blue-600" />
                Rincian Omzet per Layanan
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {monthlySummary.serviceBreakdown.length === 0 ? (
                  <div className="py-4 text-center text-slate-400">Belum ada transaksi layanan.</div>
                ) : (
                  monthlySummary.serviceBreakdown.map((s, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800">{s.serviceName}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {s.totalQty} {s.unitType}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">{formatRupiah(s.totalAmount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cashier breakdown */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                Kinerja Penjualan per Kasir
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {monthlySummary.cashierBreakdown.length === 0 ? (
                  <div className="py-4 text-center text-slate-400">Belum ada transaksi kasir.</div>
                ) : (
                  monthlySummary.cashierBreakdown.map((c, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800">{c.cashierName}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {c.orderCount} pesanan diproses
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">{formatRupiah(c.totalOmzet)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: DAFTAR PIUTANG LAUNDRY */}
      {activeTab === "receivables" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Daftar Piutang Cucian Pelanggan</h3>
              <p className="text-xs text-slate-500">
                Order aktif yang belum lunas beserta umur piutang dan aksi tagih via WhatsApp
              </p>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Invoice / Tanggal</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4 text-right">Total Tagihan</th>
                  <th className="py-3 px-4 text-right">Sudah Bayar</th>
                  <th className="py-3 px-4 text-right">Sisa Piutang</th>
                  <th className="py-3 px-4 text-center">Umur Piutang</th>
                  <th className="py-3 px-4 text-center">Aksi Tagih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receivables.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Tidak ada piutang tertunggak! Semua pesanan aktif sudah lunas. ✨
                    </td>
                  </tr>
                ) : (
                  receivables.map((r) => {
                    const waMessage = buildBillingWhatsAppMessage({
                      customerName: r.customerName,
                      invoiceNo: r.invoiceNo,
                      outletName,
                      total: r.total,
                      paidAmount: r.paidAmount,
                      remaining: r.remaining,
                      date: formatDateOnly(r.createdAt),
                    });

                    return (
                      <tr key={r.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div>{r.invoiceNo}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {formatDateOnly(r.createdAt)}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{r.customerName}</div>
                          <div className="text-[10px] text-slate-500">{r.customerPhone}</div>
                        </td>

                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatRupiah(r.total)}
                        </td>

                        <td className="py-3 px-4 text-right font-medium text-emerald-600">
                          {formatRupiah(r.paidAmount)}
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-rose-600">
                          {formatRupiah(r.remaining)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.daysAged > 7
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {r.daysAged} Hari
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <a
                            href={generateWhatsAppUrl(r.customerPhone, waMessage)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Tagih via WA
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View for Receivables */}
          <div className="md:hidden divide-y divide-slate-100">
            {receivables.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Tidak ada piutang tertunggak! Semua pesanan aktif sudah lunas. ✨
              </div>
            ) : (
              receivables.map((r) => {
                const waMessage = buildBillingWhatsAppMessage({
                  customerName: r.customerName,
                  invoiceNo: r.invoiceNo,
                  outletName,
                  total: r.total,
                  paidAmount: r.paidAmount,
                  remaining: r.remaining,
                  date: formatDateOnly(r.createdAt),
                });

                return (
                  <div key={r.id} className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{r.invoiceNo}</div>
                        <div className="text-[10px] text-slate-400">{formatDateOnly(r.createdAt)}</div>
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.daysAged > 7
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        Umur: {r.daysAged} Hari
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">{r.customerName}</div>
                        <div className="text-[11px] text-slate-500">{r.customerPhone}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Sisa Piutang:</span>
                        <span className="font-extrabold text-sm text-rose-600">{formatRupiah(r.remaining)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500">
                        Total {formatRupiah(r.total)} &bull; DP {formatRupiah(r.paidAmount)}
                      </div>
                      <a
                        href={generateWhatsAppUrl(r.customerPhone, waMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Tagih via WA
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
