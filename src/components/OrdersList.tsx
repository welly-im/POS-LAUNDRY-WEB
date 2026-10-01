import React, { useState, useMemo } from "react";
import {
  formatRupiah,
  formatDate,
  generateWhatsAppUrl,
  buildOrderReadyWhatsAppMessage,
} from "../lib/format";
import { showConfirm, showToast } from "../lib/dialog";
import { ThermalReceiptModal } from "./ThermalReceiptModal";
import {
  Search,
  Plus,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  MessageCircle,
  Printer,
  ChevronRight,
  RotateCcw,
  XCircle,
  User,
  Phone,
  Banknote,
  CreditCard,
  AlertTriangle,
  Loader2,
  Calendar,
  Sparkles
} from "lucide-react";

interface OrderItem {
  id: string;
  serviceName: string;
  unitType: "kg" | "pcs";
  unitPrice: number;
  quantity: string | number;
  subtotal: number;
  note?: string | null;
}

interface PaymentItem {
  id: string;
  kind: string;
  method: string;
  amount: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
  reference?: string | null;
  createdAt: string;
}

interface OrderRecord {
  id: string;
  invoiceNo: string;
  createdAt: string;
  status: "diterima" | "diproses" | "selesai" | "sudah_diambil" | "dibatalkan";
  subtotal: number;
  promoDiscount: number;
  manualDiscount: number;
  manualDiscountReason?: string | null;
  total: number;
  paidAmount: number;
  estimatedDoneAt?: string | null;
  note?: string | null;
  cancelReason?: string | null;
  isRefunded?: boolean;
  shiftId?: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
  };
  items: OrderItem[];
  payments: PaymentItem[];
  creator?: {
    fullName: string;
  };
}

interface OrdersListProps {
  initialOrders: OrderRecord[];
  userRole: "owner" | "kasir";
  currentUserId: string;
  activeShiftId?: string | null;
  outlet: {
    name: string;
    address?: string | null;
    phone?: string | null;
    receiptFooter?: string | null;
  };
}

export const OrdersList: React.FC<OrdersListProps> = ({
  initialOrders,
  userRole,
  currentUserId,
  activeShiftId,
  outlet,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Selected order for detail drawer
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Settlement dialog state
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settleMethod, setSettleMethod] = useState<"tunai" | "qris">("tunai");
  const [settleCashReceived, setSettleCashReceived] = useState<string>("");
  const [settleQrisRef, setSettleQrisRef] = useState("");
  const [ownerOverrideReason, setOwnerOverrideReason] = useState("");
  const [settlingPayment, setSettlingPayment] = useState(false);

  // Cancel dialog state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundDecision, setRefundDecision] = useState<"refund" | "forfeit">("refund");
  const [cancellingOrder, setCancellingOrder] = useState(false);

  // Receipt modal state
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null);

  const [loadingAction, setLoadingAction] = useState(false);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !searchQuery ||
        o.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer.phone.includes(searchQuery);

      const matchStatus = statusFilter === "all" || o.status === statusFilter;

      let matchPay = true;
      if (paymentFilter === "lunas") {
        matchPay = o.paidAmount >= o.total;
      } else if (paymentFilter === "dp") {
        matchPay = o.paidAmount > 0 && o.paidAmount < o.total;
      } else if (paymentFilter === "unpaid") {
        matchPay = o.paidAmount === 0;
      }

      return matchSearch && matchStatus && matchPay;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter]);

  // Check if order is overdue
  const isOrderOverdue = (order: OrderRecord) => {
    if (!order.estimatedDoneAt) return false;
    if (order.status === "selesai" || order.status === "sudah_diambil" || order.status === "dibatalkan") {
      return false;
    }
    return new Date(order.estimatedDoneAt).getTime() < Date.now();
  };

  // Status progression action
  const handleAdvanceStatus = async (order: OrderRecord, targetStatus: string) => {
    const remaining = order.total - order.paidAmount;

    // If target is sudah_diambil and has unpaid balance, trigger settlement dialog
    if (targetStatus === "sudah_diambil" && remaining > 0) {
      setSelectedOrder(order);
      setSettleCashReceived(remaining.toString());
      setShowSettlementModal(true);
      return;
    }

    setLoadingAction(true);
    try {
      const res = await fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          newStatus: targetStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal mengubah status pesanan");
        setLoadingAction(false);
        return;
      }

      // Update state locally
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: targetStatus as any } : o))
      );
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({ ...selectedOrder, status: targetStatus as any });
      }
      showToast.success(`Status pesanan berhasil diubah ke ${targetStatus.toUpperCase()}`);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Backward status correction (1 step back)
  const handleStepBackStatus = async (order: OrderRecord, prevStatus: string) => {
    const confirmed = await showConfirm({
      title: "Kembalikan Status",
      message: `Kembalikan status pesanan ${order.invoiceNo} ke "${prevStatus.toUpperCase()}"?`,
      confirmText: "Ya, Kembalikan",
      cancelText: "Batal",
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    setLoadingAction(true);
    try {
      const res = await fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          newStatus: prevStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal mengembalikan status");
        setLoadingAction(false);
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: prevStatus as any } : o))
      );
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({ ...selectedOrder, status: prevStatus as any });
      }
      showToast.success(`Status berhasil dikembalikan ke ${prevStatus.toUpperCase()}`);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Submit Settlement & Pickup
  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setSettlingPayment(true);
    const remaining = selectedOrder.total - selectedOrder.paidAmount;

    try {
      const payload: any = {
        orderId: selectedOrder.id,
        newStatus: "sudah_diambil",
      };

      if (ownerOverrideReason.trim()) {
        payload.ownerOverrideReason = ownerOverrideReason.trim();
      } else {
        payload.paymentAmount = remaining;
        payload.paymentMethod = settleMethod;
        payload.cashReceived =
          settleMethod === "tunai"
            ? parseInt(settleCashReceived.replace(/\D/g, "") || "0", 10)
            : null;
        payload.paymentReference = settleMethod === "qris" ? settleQrisRef : null;
      }

      const res = await fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal memproses pelunasan.");
        setSettlingPayment(false);
        return;
      }

      // Update state
      const updatedOrder = {
        ...selectedOrder,
        status: "sudah_diambil" as const,
        paidAmount: ownerOverrideReason ? selectedOrder.paidAmount : selectedOrder.total,
      };

      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? updatedOrder : o)));
      setSelectedOrder(updatedOrder);
      setShowSettlementModal(false);
      setOwnerOverrideReason("");
      setSettleQrisRef("");
      showToast.success("Pelunasan & pengambilan pesanan berhasil dicatat!");
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setSettlingPayment(false);
    }
  };

  // Submit Cancellation
  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (!cancelReason || cancelReason.trim().length < 5) {
      showToast.warning("Alasan pembatalan minimal 5 karakter.");
      return;
    }

    setCancellingOrder(true);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          reason: cancelReason,
          refundDecision,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal membatalkan pesanan.");
        setCancellingOrder(false);
        return;
      }

      const cancelledOrder = {
        ...selectedOrder,
        status: "dibatalkan" as const,
        cancelReason,
        isRefunded: refundDecision === "refund",
      };

      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? cancelledOrder : o)));
      setSelectedOrder(cancelledOrder);
      setShowCancelModal(false);
      setCancelReason("");
      showToast.success("Pesanan berhasil dibatalkan.");
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setCancellingOrder(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "diterima":
        return <span className="bg-sky-100 text-sky-800 border-sky-200 border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Diterima</span>;
      case "diproses":
        return <span className="bg-amber-100 text-amber-800 border-amber-200 border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase animate-pulse">Diproses</span>;
      case "selesai":
        return <span className="bg-emerald-100 text-emerald-800 border-emerald-200 border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Selesai (Siap)</span>;
      case "sudah_diambil":
        return <span className="bg-slate-100 text-slate-700 border-slate-200 border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Sudah Diambil</span>;
      case "dibatalkan":
        return <span className="bg-rose-100 text-rose-800 border-rose-200 border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Dibatalkan</span>;
      default:
        return null;
    }
  };

  const getPaymentBadge = (total: number, paid: number) => {
    if (paid >= total) {
      return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">Lunas</span>;
    }
    if (paid > 0) {
      return (
        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
          DP: {formatRupiah(paid)}
        </span>
      );
    }
    return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">Belum Bayar</span>;
  };

  return (
    <div className="space-y-6">
      {/* Receipt / Thermal Modal */}
      {receiptOrder && (
        <ThermalReceiptModal
          order={receiptOrder as any}
          isReprint={true}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {/* Top Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Invoice (LDR-...), Nama Pelanggan, atau No HP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Payment filter */}
          <div className="sm:col-span-3">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Status Bayar</option>
              <option value="unpaid">Belum Bayar</option>
              <option value="dp">DP (Uang Muka)</option>
              <option value="lunas">Lunas</option>
            </select>
          </div>

          {/* Action button: New order */}
          <div className="sm:col-span-3">
            <a
              href="/pos"
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Order Kasir Baru
            </a>
          </div>
        </div>

        {/* Status Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none border-t border-slate-100 pt-3">
          {[
            { id: "all", label: "Semua Pesanan" },
            { id: "diterima", label: "Diterima" },
            { id: "diproses", label: "Diproses" },
            { id: "selesai", label: "Selesai (Siap Ambil)" },
            { id: "sudah_diambil", label: "Sudah Diambil" },
            { id: "dibatalkan", label: "Dibatalkan" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Invoice / Waktu</th>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4">Status Cucian</th>
                <th className="py-3 px-4">Status Pembayaran</th>
                <th className="py-3 px-4 text-right">Total Tagihan</th>
                <th className="py-3 px-4">Estimasi Selesai</th>
                <th className="py-3 px-4 text-center">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Tidak ada data pesanan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const overdue = isOrderOverdue(ord);
                  const remaining = ord.total - ord.paidAmount;

                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(ord)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{ord.invoiceNo}</span>
                          {overdue && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" title="Lewat estimasi waktu!" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatDate(ord.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {ord.customer.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {ord.customer.phone}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(ord.status)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          {getPaymentBadge(ord.total, ord.paidAmount)}
                          {remaining > 0 && ord.status !== "dibatalkan" && (
                            <span className="text-[10px] text-rose-600 font-semibold">
                              Sisa: {formatRupiah(remaining)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatRupiah(ord.total)}
                      </td>

                      <td className="py-3 px-4">
                        <div className={`text-[11px] font-medium ${overdue ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                          {formatDate(ord.estimatedDoneAt)}
                        </div>
                        {overdue && (
                          <span className="text-[9px] font-bold text-rose-600 block uppercase">
                            Lewat Estimasi!
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick WhatsApp notify button when ready */}
                          {ord.status === "selesai" && (
                            <a
                              href={generateWhatsAppUrl(
                                ord.customer.phone,
                                buildOrderReadyWhatsAppMessage({
                                  customerName: ord.customer.name,
                                  invoiceNo: ord.invoiceNo,
                                  outletName: outlet.name,
                                  total: ord.total,
                                  paidAmount: ord.paidAmount,
                                })
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Kabari Pelanggan via WhatsApp"
                              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => setReceiptOrder(ord)}
                            title="Cetak Struk"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedOrder(ord)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL ORDER DRAWER / MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Detail Pesanan Laundry
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedOrder.invoiceNo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Status Stepper Progression */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 uppercase">
                    Alur Status Pesanan
                  </span>
                  {getStatusBadge(selectedOrder.status)}
                </div>

                {/* Linear Status Buttons */}
                {selectedOrder.status !== "dibatalkan" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {selectedOrder.status === "diterima" && (
                        <button
                          type="button"
                          disabled={loadingAction}
                          onClick={() => handleAdvanceStatus(selectedOrder, "diproses")}
                          className="col-span-3 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          Mulai Cuci (Status: Diproses)
                        </button>
                      )}

                      {selectedOrder.status === "diproses" && (
                        <>
                          <button
                            type="button"
                            disabled={loadingAction}
                            onClick={() => handleStepBackStatus(selectedOrder, "diterima")}
                            className="py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Kembali ke Diterima
                          </button>
                          <button
                            type="button"
                            disabled={loadingAction}
                            onClick={() => handleAdvanceStatus(selectedOrder, "selesai")}
                            className="col-span-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Cucian Selesai (Siap Diambil)
                          </button>
                        </>
                      )}

                      {selectedOrder.status === "selesai" && (
                        <>
                          <button
                            type="button"
                            disabled={loadingAction}
                            onClick={() => handleStepBackStatus(selectedOrder, "diproses")}
                            className="py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Kembali ke Diproses
                          </button>
                          <button
                            type="button"
                            disabled={loadingAction}
                            onClick={() => handleAdvanceStatus(selectedOrder, "sudah_diambil")}
                            className="col-span-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Serahkan ke Pelanggan (Ambil)
                          </button>
                        </>
                      )}

                      {selectedOrder.status === "sudah_diambil" && (
                        <div className="col-span-3 p-2.5 bg-slate-100 rounded-xl text-center text-slate-600 font-semibold">
                          Pesanan sudah selesai diambil oleh pelanggan.
                        </div>
                      )}
                    </div>

                    {/* WhatsApp notification button when Selesai */}
                    {selectedOrder.status === "selesai" && (
                      <a
                        href={generateWhatsAppUrl(
                          selectedOrder.customer.phone,
                          buildOrderReadyWhatsAppMessage({
                            customerName: selectedOrder.customer.name,
                            invoiceNo: selectedOrder.invoiceNo,
                            outletName: outlet.name,
                            total: selectedOrder.total,
                            paidAmount: selectedOrder.paidAmount,
                          })
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 text-center cursor-pointer shadow-xs"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Kabari Pelanggan via WhatsApp (wa.me)
                      </a>
                    )}
                  </div>
                )}

                {selectedOrder.status === "dibatalkan" && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
                    <span className="font-bold block">Pesanan Dibatalkan</span>
                    <p className="text-[11px] italic">
                      Alasan: &ldquo;{selectedOrder.cancelReason || "-"}&rdquo;
                    </p>
                    <p className="text-[10px] text-rose-600">
                      Status DP: {selectedOrder.isRefunded ? "Dikembalikan ke pelanggan (Refund)" : "Hangus"}
                    </p>
                  </div>
                )}
              </div>

              {/* Customer info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                  Informasi Pelanggan
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama:</span>
                  <span className="font-semibold text-slate-900">{selectedOrder.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. WhatsApp / HP:</span>
                  <span className="font-semibold text-slate-900">{selectedOrder.customer.phone}</span>
                </div>
                {selectedOrder.customer.address && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Alamat:</span>
                    <span className="font-medium text-slate-700 text-right max-w-xs">{selectedOrder.customer.address}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                  Rincian Item Layanan ({selectedOrder.items.length})
                </span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="p-3 flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-slate-900">{it.serviceName}</div>
                        <div className="text-[11px] text-slate-500">
                          {it.quantity} {it.unitType} &times; {formatRupiah(it.unitPrice)}
                        </div>
                        {it.note && (
                          <div className="text-[10px] text-amber-700 italic mt-0.5">
                            * Catatan: {it.note}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-slate-900">{formatRupiah(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.promoDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Diskon Promo:</span>
                    <span>-{formatRupiah(selectedOrder.promoDiscount)}</span>
                  </div>
                )}
                {selectedOrder.manualDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Diskon Khusus ({selectedOrder.manualDiscountReason || "-"}):</span>
                    <span>-{formatRupiah(selectedOrder.manualDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Tagihan:</span>
                  <span className="text-blue-600">{formatRupiah(selectedOrder.total)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Total Terbayar:</span>
                  <span className="font-semibold">{formatRupiah(selectedOrder.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-dotted border-slate-200 text-slate-800">
                  <span>Sisa Tagihan:</span>
                  <span className={selectedOrder.total - selectedOrder.paidAmount <= 0 ? "text-emerald-600" : "text-rose-600 font-extrabold"}>
                    {selectedOrder.total - selectedOrder.paidAmount <= 0
                      ? "LUNAS"
                      : formatRupiah(selectedOrder.total - selectedOrder.paidAmount)}
                  </span>
                </div>
              </div>

              {/* History of Payments */}
              {selectedOrder.payments.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
                    Riwayat Pembayaran
                  </span>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-[11px]">
                    {selectedOrder.payments.map((p, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-semibold uppercase text-slate-800">
                            {p.kind} ({p.method})
                          </span>
                          <span className="text-slate-400 block text-[10px]">
                            {formatDate(p.createdAt)}
                          </span>
                        </div>
                        <span className={`font-bold ${p.kind === "refund" ? "text-rose-600" : "text-slate-900"}`}>
                          {p.kind === "refund" ? "-" : "+"}
                          {formatRupiah(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Drawer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptOrder(selectedOrder)}
                  className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Struk
                </button>
              </div>

              {selectedOrder.status !== "sudah_diambil" && selectedOrder.status !== "dibatalkan" && (
                <button
                  type="button"
                  onClick={() => {
                    setCancelReason("");
                    setShowCancelModal(true);
                  }}
                  className="py-2.5 px-3 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Batalkan Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pelunasan Saat Pengambilan Cucian */}
      {showSettlementModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                Pelunasan Pengambilan Cucian
              </h3>
              <button
                type="button"
                onClick={() => setShowSettlementModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex justify-between items-center">
              <span>Sisa Tagihan Belum Lunas:</span>
              <span className="font-extrabold text-sm text-rose-900">
                {formatRupiah(selectedOrder.total - selectedOrder.paidAmount)}
              </span>
            </div>

            <form onSubmit={handleConfirmSettlement} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettleMethod("tunai")}
                  className={`p-2.5 rounded-xl border font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                    settleMethod === "tunai"
                      ? "bg-blue-50 border-blue-500 text-blue-800"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  Tunai
                </button>
                <button
                  type="button"
                  onClick={() => setSettleMethod("qris")}
                  className={`p-2.5 rounded-xl border font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                    settleMethod === "qris"
                      ? "bg-blue-50 border-blue-500 text-blue-800"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  QRIS / Transfer
                </button>
              </div>

              {settleMethod === "tunai" ? (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Uang Tunai Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    value={settleCashReceived}
                    onChange={(e) => setSettleCashReceived(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  {parseInt(settleCashReceived.replace(/\D/g, "") || "0", 10) >
                    selectedOrder.total - selectedOrder.paidAmount && (
                    <div className="mt-1 text-emerald-700 font-bold text-xs">
                      Kembalian:{" "}
                      {formatRupiah(
                        parseInt(settleCashReceived.replace(/\D/g, "") || "0", 10) -
                          (selectedOrder.total - selectedOrder.paidAmount)
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Referensi QRIS / Transfer (Opsional)
                  </label>
                  <input
                    type="text"
                    value={settleQrisRef}
                    onChange={(e) => setSettleQrisRef(e.target.value)}
                    placeholder="No. Referensi..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              )}

              {/* Owner Override Option */}
              {userRole === "owner" && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="font-semibold text-amber-800 block mb-1 text-[11px]">
                    Atau Override Owner (Ambil tanpa pelunasan sekarang):
                  </label>
                  <input
                    type="text"
                    placeholder="Alasan override izin owner..."
                    value={ownerOverrideReason}
                    onChange={(e) => setOwnerOverrideReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={settlingPayment}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {settlingPayment ? "Memproses..." : "Lunasi & Selesaikan Pengambilan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Batalkan Order */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Batalkan Pesanan {selectedOrder.invoiceNo}
              </h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Alasan Pembatalan (Wajib minimal 5 karakter) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Pelanggan salah membawa barang / cucian rusak sebelum dicuci..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>

              {/* If DP paid, mandatory decision (FR-CAN-02) */}
              {selectedOrder.paidAmount > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <span className="font-bold text-amber-900 block">
                    Uang Muka (DP) Terbayar: {formatRupiah(selectedOrder.paidAmount)}
                  </span>
                  <p className="text-[11px] text-amber-800">
                    Tentukan perlakuan uang pembayaran yang sudah masuk:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundDecision("refund")}
                      className={`p-2 rounded-lg font-semibold border text-center cursor-pointer ${
                        refundDecision === "refund"
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-white text-slate-700 border-slate-300"
                      }`}
                    >
                      Kembalikan (Refund)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundDecision("forfeit")}
                      className={`p-2 rounded-lg font-semibold border text-center cursor-pointer ${
                        refundDecision === "forfeit"
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300"
                      }`}
                    >
                      Tidak Dikembalikan (Hangus)
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={cancellingOrder}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {cancellingOrder ? "Membatalkan..." : "Konfirmasi Pembatalan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
