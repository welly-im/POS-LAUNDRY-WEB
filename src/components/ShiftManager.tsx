import React, { useState } from "react";
import { formatRupiah, formatDate } from "../lib/format";
import {
  Coins,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Printer,
  Calendar,
  User,
  FileText,
  Clock,
  RefreshCw,
  Wallet,
  Receipt
} from "lucide-react";

interface ShiftData {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  openingCash: number;
  cashIn: number;
  cashRefund: number;
  expectedCash: number;
  qrisIn: number;
  totalRealIncome: number;
  orderCount: number;
  totalPiutang: number;
}

interface HistoricalShift {
  id: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  countedCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  closingNote: string | null;
}

interface ShiftManagerProps {
  initialActiveShift: ShiftData | null;
  historicalShifts: HistoricalShift[];
  currentUserName: string;
  outletName: string;
}

export const ShiftManager: React.FC<ShiftManagerProps> = ({
  initialActiveShift,
  historicalShifts,
  currentUserName,
  outletName,
}) => {
  const [activeShift, setActiveShift] = useState<ShiftData | null>(initialActiveShift);
  const [openingCashInput, setOpeningCashInput] = useState<string>("100000");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Closing modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<string>("");
  const [closingNote, setClosingNote] = useState("");

  // Post-closing receipt modal state
  const [closedReceipt, setClosedReceipt] = useState<any | null>(null);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const val = parseInt(openingCashInput.replace(/\D/g, "") || "0", 10);
    if (isNaN(val) || val < 0) {
      setErrorMsg("Kas awal tidak valid.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash: val }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal membuka shift.");
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch (err: any) {
      setErrorMsg("Koneksi gagal.");
      setLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const countedVal = parseInt(countedCashInput.replace(/\D/g, "") || "0", 10);
    if (isNaN(countedVal) || countedVal < 0) {
      setErrorMsg("Uang fisik di laci tidak valid.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedCash: countedVal, closingNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal menutup shift.");
        setLoading(false);
        return;
      }

      setShowCloseModal(false);
      setClosedReceipt(data.summary);
      setActiveShift(null);
      setLoading(false);
    } catch (err: any) {
      setErrorMsg("Koneksi gagal.");
      setLoading(false);
    }
  };

  // Difference calculation in closing modal
  const numericCounted = parseInt(countedCashInput.replace(/\D/g, "") || "0", 10);
  const diff = activeShift ? numericCounted - activeShift.expectedCash : 0;

  return (
    <div className="space-y-8">
      {/* Thermal Print View (Hidden on screen, shown on window.print()) */}
      {closedReceipt && (
        <div className="print-only thermal-receipt font-mono text-[10px] leading-tight text-black">
          <div className="text-center pb-2 border-b border-dashed border-black mb-2">
            <div className="font-bold text-xs uppercase">{closedReceipt.outletName}</div>
            <div>REKAP PENUTUPAN SHIFT</div>
            <div>================================</div>
          </div>
          <div className="space-y-1 mb-2 text-[10px]">
            <div>Kasir: {closedReceipt.cashierName}</div>
            <div>Buka: {formatDate(closedReceipt.openedAt)}</div>
            <div>Tutup: {formatDate(closedReceipt.closedAt)}</div>
            <div>Jumlah Order: {closedReceipt.orderCount}</div>
          </div>
          <div className="border-t border-b border-dashed border-black py-1.5 my-2 space-y-1">
            <div className="flex justify-between">
              <span>Kas Awal:</span>
              <span>{formatRupiah(closedReceipt.openingCash)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) Tunai Masuk:</span>
              <span>{formatRupiah(closedReceipt.cashIn)}</span>
            </div>
            <div className="flex justify-between">
              <span>(-) Refund Tunai:</span>
              <span>{formatRupiah(closedReceipt.cashRefund)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-black pt-1">
              <span>(=) Seharusnya di Laci:</span>
              <span>{formatRupiah(closedReceipt.expectedCash)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Uang Fisik Dihitung:</span>
              <span>{formatRupiah(closedReceipt.countedCash)}</span>
            </div>
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-dotted border-black">
              <span>Selisih:</span>
              <span>{closedReceipt.cashDifference >= 0 ? "+" : ""}{formatRupiah(closedReceipt.cashDifference)}</span>
            </div>
          </div>
          <div className="space-y-1 text-[10px] mb-2">
            <div className="flex justify-between">
              <span>Pembayaran QRIS:</span>
              <span>{formatRupiah(closedReceipt.qrisIn)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total Uang Riil:</span>
              <span>{formatRupiah(closedReceipt.totalRealIncome)}</span>
            </div>
            <div>Catatan: {closedReceipt.closingNote || "-"}</div>
          </div>
          <div className="text-center pt-2 border-t border-dashed border-black mt-3">
            <div>--- SERAH TERIMA SHIFT ---</div>
            <div className="mt-6 flex justify-between px-2 text-[9px]">
              <div>( Kasir )</div>
              <div>( Owner/Supervisor )</div>
            </div>
          </div>
        </div>
      )}

      {/* Screen View */}
      <div className="no-print">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Perhatian</p>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Closed Receipt Screen Modal */}
        {closedReceipt && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-2">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Shift Berhasil Ditutup</h3>
                <p className="text-xs text-slate-500">
                  Laporan rekap kasir telah dicatat di sistem
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Kasir:</span>
                  <span className="font-semibold text-slate-800">{closedReceipt.cashierName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Kas Seharusnya di Laci:</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(closedReceipt.expectedCash)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Uang Fisik Dihitung:</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(closedReceipt.countedCash)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-bold">
                  <span>Selisih Kas:</span>
                  <span className={closedReceipt.cashDifference === 0 ? "text-emerald-600" : closedReceipt.cashDifference < 0 ? "text-rose-600" : "text-amber-600"}>
                    {closedReceipt.cashDifference >= 0 ? "+" : ""}{formatRupiah(closedReceipt.cashDifference)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1">
                  <span>Total Uang Riil (Tunai + QRIS):</span>
                  <span className="font-semibold text-blue-700">{formatRupiah(closedReceipt.totalRealIncome)}</span>
                </div>
                {closedReceipt.closingNote && (
                  <div className="pt-2 border-t border-slate-200 text-slate-500 italic">
                    Catatan: &ldquo;{closedReceipt.closingNote}&rdquo;
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Struk Rekap
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClosedReceipt(null);
                    window.location.reload();
                  }}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Shift Card or Open Shift Form */}
        {!activeShift ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-xl mx-auto">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Coins className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Shift Belum Dibuka</h2>
              <p className="text-sm text-slate-500 mt-1">
                Masukkan modal kas awal di laci kasir untuk mulai menerima pesanan laundry.
              </p>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Modal Kas Awal (Uang Tunai di Laci)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-bold text-slate-400 text-sm">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    placeholder="Contoh: 100000"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {[50000, 100000, 150000, 200000, 500000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOpeningCashInput(preset.toString())}
                      className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      {formatRupiah(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-xl text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? "Membuka Shift..." : "Buka Shift Kasir Sekarang"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header Status */}
            <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                    Shift Sedang Aktif
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight">
                  Kasir: {activeShift.cashierName}
                </h2>
                <div className="text-xs text-blue-100 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Buka: {formatDate(activeShift.openedAt)}
                  </span>
                  <span>&bull;</span>
                  <span>{activeShift.orderCount} Order dibuat</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(true)}
                  className="px-4 py-2.5 bg-white text-rose-600 hover:bg-rose-50 font-semibold rounded-xl text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Coins className="w-4 h-4" />
                  Tutup Shift (Closing)
                </button>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 font-medium block mb-1">
                  Modal Kas Awal
                </span>
                <span className="text-lg font-bold text-slate-900">
                  {formatRupiah(activeShift.openingCash)}
                </span>
              </div>

              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                <span className="text-xs text-emerald-700 font-medium block mb-1">
                  (+) Tunai Masuk
                </span>
                <span className="text-lg font-bold text-emerald-800">
                  {formatRupiah(activeShift.cashIn)}
                </span>
              </div>

              <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-100">
                <span className="text-xs text-rose-700 font-medium block mb-1">
                  (-) Refund Tunai
                </span>
                <span className="text-lg font-bold text-rose-800">
                  {formatRupiah(activeShift.cashRefund)}
                </span>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <span className="text-xs text-blue-700 font-semibold block mb-1">
                  (=) Uang di Laci (Seharusnya)
                </span>
                <span className="text-xl font-extrabold text-blue-900">
                  {formatRupiah(activeShift.expectedCash)}
                </span>
              </div>

              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                <span className="text-xs text-indigo-700 font-medium block mb-1">
                  Pembayaran QRIS
                </span>
                <span className="text-lg font-bold text-indigo-800">
                  {formatRupiah(activeShift.qrisIn)}
                </span>
                <span className="text-[10px] text-indigo-500 block mt-0.5">
                  Masuk ke rekening/bank
                </span>
              </div>

              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100">
                <span className="text-xs text-amber-700 font-medium block mb-1">
                  Total Pendapatan Riil
                </span>
                <span className="text-lg font-bold text-amber-800">
                  {formatRupiah(activeShift.totalRealIncome)}
                </span>
                <span className="text-[10px] text-amber-600 block mt-0.5">
                  Tunai Bersih + QRIS
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 font-medium block mb-1">
                  Piutang Laundry Berjalan
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {formatRupiah(activeShift.totalPiutang)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Total cucian belum lunas
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-xs text-slate-500 font-medium block">
                  Aksi Cepat
                </span>
                <a
                  href="/pos"
                  className="mt-2 text-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Buka Menu Kasir (POS) &rarr;
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Modal Closing Shift */}
        {showCloseModal && activeShift && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Penutupan Shift Kasir</h3>
                  <p className="text-xs text-slate-500">
                    Hitung uang tunai fisik yang ada di laci dan bandingkan dengan sistem
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Summary Cards */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Kas Awal:</span>
                  <span className="font-semibold">{formatRupiah(activeShift.openingCash)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>(+) Tunai Masuk:</span>
                  <span className="font-semibold text-emerald-600">{formatRupiah(activeShift.cashIn)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>(-) Refund Tunai:</span>
                  <span className="font-semibold text-rose-600">{formatRupiah(activeShift.cashRefund)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>Uang Seharusnya di Laci:</span>
                  <span className="text-blue-600">{formatRupiah(activeShift.expectedCash)}</span>
                </div>
              </div>

              <form onSubmit={handleCloseShift} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Hasil Hitung Uang Fisik di Laci
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-bold text-slate-400 text-sm">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      required
                      autoFocus
                      value={countedCashInput}
                      onChange={(e) => setCountedCashInput(e.target.value)}
                      placeholder="Masukkan total uang di laci..."
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Variance Badge */}
                {countedCashInput !== "" && (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      diff === 0
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : diff < 0
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    <span className="font-medium">
                      Status Selisih:{" "}
                      <strong>
                        {diff === 0
                          ? "Pas / Sesuai (Rp 0)"
                          : diff < 0
                          ? `Kurang / Minus ${formatRupiah(Math.abs(diff))}`
                          : `Lebih / Surplus ${formatRupiah(diff)}`}
                      </strong>
                    </span>
                    {diff !== 0 && (
                      <span className="text-[10px] bg-white px-2 py-0.5 rounded-full font-semibold border">
                        Catatan Wajib
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Penutupan Shift {diff !== 0 && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    rows={2}
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                    required={diff !== 0}
                    placeholder={
                      diff !== 0
                        ? "Jelaskan penyebab selisih kas (wajib)..."
                        : "Catatan serah terima shift (opsional)..."
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold rounded-xl text-xs shadow-md shadow-rose-500/20 flex items-center gap-2 cursor-pointer"
                  >
                    {loading ? "Menutup..." : "Konfirmasi Tutup Shift"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* History Table */}
        <div className="mt-12 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Riwayat Shift Sebelumnya</h3>
              <p className="text-xs text-slate-500">Daftar rekapitulasi shift kasir yang telah ditutup</p>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Kasir</th>
                  <th className="py-3 px-4">Waktu Buka / Tutup</th>
                  <th className="py-3 px-4 text-right">Kas Awal</th>
                  <th className="py-3 px-4 text-right">Seharusnya</th>
                  <th className="py-3 px-4 text-right">Fisik Laci</th>
                  <th className="py-3 px-4 text-right">Selisih</th>
                  <th className="py-3 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historicalShifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada riwayat shift yang ditutup.
                    </td>
                  </tr>
                ) : (
                  historicalShifts.map((h) => {
                    const diffVal = h.cashDifference ?? 0;
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {h.cashierName}
                        </td>
                        <td className="py-3 px-4">
                          <div>{formatDate(h.openedAt)}</div>
                          <div className="text-[10px] text-slate-400">
                            {h.closedAt ? formatDate(h.closedAt) : "Belum Ditutup"}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatRupiah(h.openingCash)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {formatRupiah(h.expectedCash)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          {formatRupiah(h.countedCash)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${
                              diffVal === 0
                                ? "bg-emerald-100 text-emerald-800"
                                : diffVal < 0
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {diffVal >= 0 ? "+" : ""}
                            {formatRupiah(diffVal)}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-500">
                          {h.closingNote || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Shift History Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {historicalShifts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Belum ada riwayat shift yang ditutup.
              </div>
            ) : (
              historicalShifts.map((h) => {
                const diffVal = h.cashDifference ?? 0;
                return (
                  <div key={h.id} className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900">{h.cashierName}</div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          diffVal === 0
                            ? "bg-emerald-100 text-emerald-800"
                            : diffVal < 0
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        Selisih: {diffVal >= 0 ? "+" : ""}{formatRupiah(diffVal)}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div>Buka: {formatDate(h.openedAt)}</div>
                      <div>Tutup: {h.closedAt ? formatDate(h.closedAt) : "Belum Ditutup"}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Kas Awal</span>
                        <span className="font-semibold text-slate-700">{formatRupiah(h.openingCash)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Seharusnya</span>
                        <span className="font-semibold text-slate-700">{formatRupiah(h.expectedCash)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Fisik Laci</span>
                        <span className="font-bold text-slate-900">{formatRupiah(h.countedCash)}</span>
                      </div>
                    </div>

                    {h.closingNote && (
                      <div className="text-[10px] text-slate-500 italic bg-white p-1.5 rounded border border-slate-100">
                        Catatan: {h.closingNote}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
