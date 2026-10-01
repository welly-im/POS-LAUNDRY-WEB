import React, { useState } from "react";
import { formatRupiah, formatDate, generateWhatsAppUrl } from "../lib/format";
import { Printer, Tag, MessageCircle, X, CheckCircle2, RotateCcw } from "lucide-react";

interface OrderDetail {
  id: string;
  invoiceNo: string;
  createdAt: string;
  status: string;
  subtotal: number;
  promoDiscount: number;
  manualDiscount: number;
  manualDiscountReason?: string | null;
  total: number;
  paidAmount: number;
  estimatedDoneAt?: string | null;
  note?: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
  };
  items: Array<{
    id: string;
    serviceName: string;
    unitType: "kg" | "pcs";
    unitPrice: number;
    quantity: string | number;
    subtotal: number;
    note?: string | null;
  }>;
  payments: Array<{
    id: string;
    kind: string;
    method: string;
    amount: number;
    cashReceived?: number | null;
    changeGiven?: number | null;
    reference?: string | null;
  }>;
  creator?: {
    fullName: string;
  };
  outlet?: {
    name: string;
    address?: string | null;
    phone?: string | null;
    receiptFooter?: string | null;
  };
}

interface ThermalReceiptModalProps {
  order: OrderDetail;
  isReprint?: boolean;
  onClose: () => void;
  onNewOrder?: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  order,
  isReprint = false,
  onClose,
  onNewOrder,
}) => {
  const [printMode, setPrintMode] = useState<"receipt" | "tag">("receipt");

  const outlet = order.outlet || {
    name: "POS LAUNDRY",
    address: "Jl. Merdeka No. 88, Jakarta",
    phone: "081234567890",
    receiptFooter: "Terima kasih atas kepercayaannya!",
  };

  const remaining = order.total - order.paidAmount;
  const isPaidOff = remaining <= 0;

  // Build WhatsApp text breakdown
  const buildWhatsAppText = () => {
    let text = `*${outlet.name.toUpperCase()}*\n`;
    text += `No. Invoice: *${order.invoiceNo}*\n`;
    text += `Tanggal: ${formatDate(order.createdAt)}\n`;
    text += `Pelanggan: ${order.customer.name}\n\n`;
    text += `*Rincian Cucian:*\n`;
    order.items.forEach((it, idx) => {
      text += `${idx + 1}. ${it.serviceName} (${it.quantity} ${it.unitType}) = ${formatRupiah(it.subtotal)}\n`;
      if (it.note) text += `   _Catatan: ${it.note}_\n`;
    });
    text += `\nSubtotal: ${formatRupiah(order.subtotal)}\n`;
    if (order.promoDiscount > 0) text += `Diskon Promo: -${formatRupiah(order.promoDiscount)}\n`;
    if (order.manualDiscount > 0) text += `Diskon Khusus: -${formatRupiah(order.manualDiscount)}\n`;
    text += `*Total: ${formatRupiah(order.total)}*\n`;
    text += `Terbayar: ${formatRupiah(order.paidAmount)}\n`;
    text += `*Sisa Tagihan: ${isPaidOff ? "LUNAS" : formatRupiah(remaining)}*\n\n`;
    if (order.estimatedDoneAt) {
      text += `Estimasi Selesai: *${formatDate(order.estimatedDoneAt)}*\n\n`;
    }
    text += `${outlet.receiptFooter || "Terima kasih!"}`;
    return text;
  };

  const handlePrint = (mode: "receipt" | "tag") => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const waUrl = generateWhatsAppUrl(order.customer.phone, buildWhatsAppText());

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      {/* 1. THERMAL PRINT STYLES (Only visible during window.print()) */}
      <div className="print-only">
        {printMode === "receipt" ? (
          <div className="thermal-receipt font-mono text-[10px] leading-tight text-black">
            {/* Header */}
            <div className="text-center pb-1.5 border-b border-dashed border-black mb-1.5">
              <div className="font-bold text-xs uppercase">{outlet.name}</div>
              {outlet.address && <div className="text-[9px]">{outlet.address}</div>}
              {outlet.phone && <div className="text-[9px]">Telp/WA: {outlet.phone}</div>}
              {isReprint && (
                <div className="font-bold text-[9px] mt-1 border-t border-black pt-0.5">
                  *** SALINAN STRUK ***
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="text-[9px] space-y-0.5 mb-1.5 border-b border-dashed border-black pb-1.5">
              <div className="flex justify-between">
                <span>Invoice:</span>
                <span className="font-bold">{order.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{order.creator?.fullName || "Kasir"}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-bold">{order.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span>No. Telp:</span>
                <span>{order.customer.phone}</span>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-1 mb-1.5 border-b border-dashed border-black pb-1.5">
              {order.items.map((item, i) => (
                <div key={item.id || i} className="text-[9px]">
                  <div className="font-bold">{item.serviceName}</div>
                  <div className="flex justify-between text-slate-700">
                    <span>
                      {item.quantity} {item.unitType} x {formatRupiah(item.unitPrice)}
                    </span>
                    <span className="font-semibold text-black">{formatRupiah(item.subtotal)}</span>
                  </div>
                  {item.note && <div className="text-[8px] italic">* {item.note}</div>}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="text-[9px] space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRupiah(order.subtotal)}</span>
              </div>
              {order.promoDiscount > 0 && (
                <div className="flex justify-between">
                  <span>Diskon Promo:</span>
                  <span>-{formatRupiah(order.promoDiscount)}</span>
                </div>
              )}
              {order.manualDiscount > 0 && (
                <div className="flex justify-between">
                  <span>Diskon Khusus:</span>
                  <span>-{formatRupiah(order.manualDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[10px] pt-1 border-t border-black">
                <span>TOTAL:</span>
                <span>{formatRupiah(order.total)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="text-[9px] space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5">
              {order.payments.map((p, i) => (
                <div key={p.id || i} className="flex justify-between">
                  <span>
                    Bayar ({p.method.toUpperCase()} - {p.kind.toUpperCase()}):
                  </span>
                  <span>{formatRupiah(p.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span>Total Terbayar:</span>
                <span className="font-bold">{formatRupiah(order.paidAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-[10px] pt-0.5 border-t border-dotted border-black">
                <span>Sisa Tagihan:</span>
                <span>{isPaidOff ? "LUNAS" : formatRupiah(remaining)}</span>
              </div>
            </div>

            {/* Estimation & Footer */}
            <div className="text-center text-[9px] space-y-1">
              {order.estimatedDoneAt && (
                <div className="border border-black p-1 rounded-xs font-bold">
                  Estimasi Selesai: {formatDate(order.estimatedDoneAt)}
                </div>
              )}
              <div className="text-[8px] leading-tight pt-1">
                {outlet.receiptFooter || "Terima kasih atas kunjungan Anda!"}
              </div>
              <div className="text-[7px] text-slate-600 pt-1">
                Dicetak: {formatDate(new Date())}
              </div>
            </div>
          </div>
        ) : (
          /* Laundry Bag/Clothes Tag Label (Slip Kecil) */
          <div className="thermal-tag font-mono text-[10px] leading-tight text-black border border-black p-2">
            <div className="text-center font-bold text-xs uppercase border-b border-black pb-1 mb-1">
              TAG NOMOR CUCIAN
            </div>
            <div className="text-center my-1">
              <div className="text-[14px] font-extrabold tracking-wider">{order.invoiceNo}</div>
              <div className="text-xs font-bold">{order.customer.name}</div>
            </div>
            <div className="border-t border-b border-dashed border-black py-1 my-1 text-[9px] space-y-0.5">
              <div className="flex justify-between">
                <span>Jumlah Item:</span>
                <span className="font-bold">{order.items.length} Layanan</span>
              </div>
              {order.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-[8px]">
                  <span className="truncate max-w-[120px]">&bull; {it.serviceName}</span>
                  <span>{it.quantity} {it.unitType}</span>
                </div>
              ))}
            </div>
            <div className="text-[8px] text-center font-bold">
              EST. SELESAI: {formatDate(order.estimatedDoneAt)}
            </div>
          </div>
        )}
      </div>

      {/* 2. ON SCREEN PREVIEW MODAL */}
      <div className="no-print bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isReprint ? "Cetak Salinan Struk" : "Pesanan Berhasil Disimpan!"}
              </h3>
              <p className="text-xs text-slate-500 font-mono font-semibold text-blue-600">
                {order.invoiceNo}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Struk Visual Preview */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 space-y-3 max-h-[360px] overflow-y-auto shadow-inner">
          <div className="text-center pb-2 border-b border-dashed border-slate-300">
            <div className="font-bold text-sm uppercase text-slate-900">{outlet.name}</div>
            <div className="text-[11px] text-slate-500">{outlet.address}</div>
            <div className="text-[11px] text-slate-500">{outlet.phone}</div>
            {isReprint && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                SALINAN
              </span>
            )}
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice:</span>
              <span className="font-bold">{order.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pelanggan:</span>
              <span className="font-semibold">{order.customer.name} ({order.customer.phone})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tanggal:</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
          </div>

          <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1.5 text-[11px]">
            {order.items.map((it, idx) => (
              <div key={idx} className="flex justify-between">
                <div>
                  <span className="font-semibold">{it.serviceName}</span>
                  <div className="text-[10px] text-slate-500">
                    {it.quantity} {it.unitType} x {formatRupiah(it.unitPrice)}
                  </div>
                  {it.note && <div className="text-[10px] text-amber-700 italic">* {it.note}</div>}
                </div>
                <span className="font-semibold">{formatRupiah(it.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span>{formatRupiah(order.subtotal)}</span>
            </div>
            {order.promoDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Diskon Promo:</span>
                <span>-{formatRupiah(order.promoDiscount)}</span>
              </div>
            )}
            {order.manualDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Diskon Khusus:</span>
                <span>-{formatRupiah(order.manualDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-300">
              <span>Total Tagihan:</span>
              <span>{formatRupiah(order.total)}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Terbayar:</span>
              <span className="font-semibold">{formatRupiah(order.paidAmount)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-dotted border-slate-300">
              <span>Sisa Tagihan:</span>
              <span className={isPaidOff ? "text-emerald-600" : "text-rose-600"}>
                {isPaidOff ? "LUNAS" : formatRupiah(remaining)}
              </span>
            </div>
          </div>

          {order.estimatedDoneAt && (
            <div className="bg-blue-50/70 border border-blue-200 text-blue-800 p-2 rounded-lg text-center text-[11px] font-semibold">
              Estimasi Selesai: {formatDate(order.estimatedDoneAt)}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handlePrint("receipt")}
            className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Cetak Struk 58mm
          </button>

          <button
            type="button"
            onClick={() => handlePrint("tag")}
            className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Tag className="w-4 h-4" />
            Cetak Tag Label
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 sm:col-span-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-center shadow-xs"
          >
            <MessageCircle className="w-4 h-4" />
            Kirim WhatsApp
          </a>
        </div>

        {onNewOrder && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              onClick={onNewOrder}
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Order Baru Lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
