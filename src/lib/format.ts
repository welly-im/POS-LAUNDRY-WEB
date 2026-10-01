export function formatRupiah(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "Rp 0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

export function formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return "";
  let cleaned = rawPhone.replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

export function generateWhatsAppUrl(phone: string, message: string): string {
  const norm = normalizePhone(phone);
  return `https://wa.me/${norm}?text=${encodeURIComponent(message)}`;
}

export function buildOrderReadyWhatsAppMessage(params: {
  customerName: string;
  invoiceNo: string;
  outletName: string;
  total: number;
  paidAmount: number;
}): string {
  const remaining = params.total - params.paidAmount;
  let statusBayar = "Lunas";
  if (remaining > 0) {
    statusBayar = `Sisa tagihan: ${formatRupiah(remaining)}`;
  }

  return `Halo Kak ${params.customerName}, cucian Anda di *${params.outletName}* dengan No. Invoice *${params.invoiceNo}* telah SELESAI dan siap diambil! ✨\n\nTotal: ${formatRupiah(params.total)}\nStatus Pembayaran: *${statusBayar}*\n\nTerima kasih atas kepercayaannya! 🙏`;
}

export function buildBillingWhatsAppMessage(params: {
  customerName: string;
  invoiceNo: string;
  outletName: string;
  total: number;
  paidAmount: number;
  remaining: number;
  date: string;
}): string {
  return `Halo Kak ${params.customerName},\n\nMengingatkan tagihan laundry di *${params.outletName}* untuk No. Invoice *${params.invoiceNo}* (${params.date}):\nTotal Tagihan: ${formatRupiah(params.total)}\nSudah Terbayar: ${formatRupiah(params.paidAmount)}\nSisa Piutang: *${formatRupiah(params.remaining)}*\n\nMohon untuk dapat menyelesaikan pembayaran saat pengambilan cucian atau transfer. Terima kasih banyak! 🙏`;
}
