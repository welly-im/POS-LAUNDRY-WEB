import React, { useState, useMemo, useEffect } from "react";
import { formatRupiah, formatDate, normalizePhone } from "../lib/format";
import { showToast } from "../lib/dialog";
import { ThermalReceiptModal } from "./ThermalReceiptModal";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Search,
  UserPlus,
  User,
  Phone,
  Clock,
  Tag,
  AlertCircle,
  Coins,
  CreditCard,
  Banknote,
  Check,
  ChevronRight,
  ShieldAlert,
  Loader2,
  X
} from "lucide-react";

interface ServiceCategory {
  id: string;
  name: string;
}

interface Service {
  id: string;
  categoryId: string;
  name: string;
  unitType: "kg" | "pcs";
  price: number;
  durationHours: number;
}

interface Promo {
  id: string;
  name: string;
  type: "persen" | "nominal";
  value: number;
  minSpend: number | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
}

interface CartItem {
  serviceId: string;
  serviceName: string;
  unitType: "kg" | "pcs";
  unitPrice: number;
  quantity: number;
  durationHours: number;
  note: string;
}

interface PosTerminalProps {
  categories: ServiceCategory[];
  services: Service[];
  promos: Promo[];
  activeShift: {
    id: string;
    openedAt: string;
  } | null;
  userRole: "owner" | "kasir";
  outlet: {
    name: string;
    address?: string | null;
    phone?: string | null;
    receiptFooter?: string | null;
  };
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  categories,
  services,
  promos,
  activeShift,
  userRole,
  outlet,
}) => {
  // Category tab
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [searchServiceQuery, setSearchServiceQuery] = useState("");

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // New customer form
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState("");

  // Discounts
  const [selectedPromoId, setSelectedPromoId] = useState<string>("");
  const [manualDiscountType, setManualDiscountType] = useState<"persen" | "nominal">("nominal");
  const [manualDiscountVal, setManualDiscountVal] = useState<string>("");
  const [manualDiscountReason, setManualDiscountReason] = useState("");
  const [ownerPin, setOwnerPin] = useState("");
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Payment state
  const [paymentOption, setPaymentOption] = useState<"unpaid" | "dp" | "full">("full");
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "qris">("tunai");
  const [dpAmountInput, setDpAmountInput] = useState<string>("");
  const [cashReceivedInput, setCashReceivedInput] = useState<string>("");
  const [qrisRef, setQrisRef] = useState("");

  // Order submission & receipt modal
  const [submitting, setSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCat =
        selectedCategoryId === "all" || s.categoryId === selectedCategoryId;
      const matchSearch =
        !searchServiceQuery ||
        s.name.toLowerCase().includes(searchServiceQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [services, selectedCategoryId, searchServiceQuery]);

  // Customer search debounce
  useEffect(() => {
    if (!customerSearchQuery.trim()) {
      setCustomerSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(customerSearchQuery)}`);
        const data = await res.json();
        setCustomerSearchResults(data.customers || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingCustomer(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [customerSearchQuery]);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + Math.round(item.quantity * item.unitPrice), 0);
  }, [cart]);

  // Max duration for estimated time
  const maxDurationHours = useMemo(() => {
    if (cart.length === 0) return 24;
    return Math.max(...cart.map((i) => i.durationHours), 24);
  }, [cart]);

  const estimatedDoneDate = useMemo(() => {
    return new Date(Date.now() + maxDurationHours * 60 * 60 * 1000);
  }, [maxDurationHours]);

  // Promo discount
  const activePromo = promos.find((p) => p.id === selectedPromoId);
  const promoDiscount = useMemo(() => {
    if (!activePromo) return 0;
    if (activePromo.minSpend && subtotal < activePromo.minSpend) return 0;
    if (activePromo.type === "persen") {
      return Math.round((subtotal * activePromo.value) / 100);
    }
    return activePromo.value;
  }, [activePromo, subtotal]);

  // Manual discount
  const manualDiscountNum = Number(manualDiscountVal) || 0;
  const manualDiscount = useMemo(() => {
    if (manualDiscountNum <= 0) return 0;
    if (manualDiscountType === "persen") {
      return Math.round((subtotal * manualDiscountNum) / 100);
    }
    return Math.round(manualDiscountNum);
  }, [manualDiscountType, manualDiscountNum, subtotal]);

  const isManualDiscountAbove20 = useMemo(() => {
    if (subtotal <= 0 || manualDiscount <= 0) return false;
    return (manualDiscount / subtotal) * 100 > 20;
  }, [manualDiscount, subtotal]);

  const total = Math.max(0, subtotal - promoDiscount - manualDiscount);

  // Pay amount according to option
  const payAmount = useMemo(() => {
    if (paymentOption === "unpaid") return 0;
    if (paymentOption === "full") return total;
    const dp = parseInt(dpAmountInput.replace(/\D/g, "") || "0", 10);
    return Math.min(dp, total);
  }, [paymentOption, total, dpAmountInput]);

  // Change calculation for cash
  const cashReceived = parseInt(cashReceivedInput.replace(/\D/g, "") || "0", 10);
  const changeAmount = paymentMethod === "tunai" && cashReceived > payAmount ? cashReceived - payAmount : 0;

  // Add item to cart
  const addToCart = (service: Service) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.serviceId === service.id);
      if (idx >= 0) {
        const copy = [...prev];
        const nextQty =
          service.unitType === "kg"
            ? Math.round((copy[idx].quantity + 1) * 100) / 100
            : copy[idx].quantity + 1;
        copy[idx] = { ...copy[idx], quantity: nextQty };
        return copy;
      }
      return [
        ...prev,
        {
          serviceId: service.id,
          serviceName: service.name,
          unitType: service.unitType,
          unitPrice: service.price,
          quantity: service.unitType === "kg" ? 1 : 1,
          durationHours: service.durationHours,
          note: "",
        },
      ];
    });
  };

  const updateQuantity = (index: number, newQty: number) => {
    setCart((prev) => {
      const copy = [...prev];
      if (newQty <= 0) {
        copy.splice(index, 1);
        return copy;
      }
      copy[index] = {
        ...copy[index],
        quantity:
          copy[index].unitType === "kg"
            ? Math.round(newQty * 100) / 100
            : Math.max(1, Math.round(newQty)),
      };
      return copy;
    });
  };

  const updateItemNote = (index: number, note: string) => {
    setCart((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], note };
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Add new customer inline
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCustomer(true);
    try {
      const res = await fetch("/api/customers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustName,
          phone: newCustPhone,
          address: newCustAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal menambah pelanggan");
        setSavingCustomer(false);
        return;
      }

      setSelectedCustomer(data.customer);
      setShowAddCustomerModal(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustAddress("");
      setCustomerSearchQuery("");
      setCustomerSearchResults([]);
      showToast.success(`Pelanggan "${data.customer.name}" berhasil didaftarkan!`);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setSavingCustomer(false);
    }
  };

  // Submit Order
  const handleSubmitOrder = async () => {
    setErrorBanner("");

    if (!activeShift) {
      setErrorBanner("Shift kasir belum dibuka. Silakan buka shift terlebih dahulu.");
      return;
    }

    if (!selectedCustomer) {
      setErrorBanner("Silakan pilih atau tambahkan pelanggan terlebih dahulu.");
      return;
    }

    if (cart.length === 0) {
      setErrorBanner("Keranjang masih kosong. Tambahkan minimal 1 layanan cucian.");
      return;
    }

    if (isManualDiscountAbove20 && userRole !== "owner" && !ownerPin) {
      setErrorBanner("Diskon manual di atas 20% memerlukan PIN otorisasi Owner.");
      setShowDiscountModal(true);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        customerId: selectedCustomer.id,
        items: cart.map((i) => ({
          serviceId: i.serviceId,
          quantity: i.quantity,
          note: i.note,
        })),
        promoId: selectedPromoId || null,
        manualDiscountType,
        manualDiscountValue: manualDiscountNum,
        manualDiscountReason: manualDiscountNum > 0 ? manualDiscountReason : null,
        ownerPin: ownerPin || null,
        paymentAmount: payAmount,
        paymentMethod,
        cashReceived: paymentMethod === "tunai" ? cashReceived : null,
        paymentReference: paymentMethod === "qris" ? qrisRef : null,
        note: orderNote || null,
      };

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorBanner(data.error || "Gagal menyimpan pesanan");
        setSubmitting(false);
        return;
      }

      // Success: open receipt modal
      setCompletedOrder(data.order);
      setSubmitting(false);
    } catch (err: any) {
      setErrorBanner("Terjadi kesalahan jaringan saat menyimpan order.");
      setSubmitting(false);
    }
  };

  const handleResetForNewOrder = () => {
    setCompletedOrder(null);
    setCart([]);
    setSelectedCustomer(null);
    setCustomerSearchQuery("");
    setOrderNote("");
    setSelectedPromoId("");
    setManualDiscountVal("");
    setManualDiscountReason("");
    setOwnerPin("");
    setPaymentOption("full");
    setDpAmountInput("");
    setCashReceivedInput("");
    setQrisRef("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Receipt Modal */}
      {completedOrder && (
        <ThermalReceiptModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
          onNewOrder={handleResetForNewOrder}
        />
      )}

      {/* No Active Shift Alert */}
      {!activeShift && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">Shift Kasir Belum Dibuka</h4>
              <p className="text-xs text-amber-700">
                Anda harus memasukkan kas awal dan membuka shift sebelum dapat memproses transaksi order.
              </p>
            </div>
          </div>
          <a
            href="/shifts"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs"
          >
            Buka Shift Sekarang &rarr;
          </a>
        </div>
      )}

      {errorBanner && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner("")}
            className="text-rose-500 hover:text-rose-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main POS Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / CENTER COLUMN: Services Catalog (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Categories Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari layanan (contoh: komplit, kemeja, sepatu, bedcover)..."
                value={searchServiceQuery}
                onChange={(e) => setSearchServiceQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("all")}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategoryId === "all"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua Layanan
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategoryId === cat.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredServices.map((service) => {
              const inCartItem = cart.find((c) => c.serviceId === service.id);
              const isKiloan = service.unitType === "kg";

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => addToCart(service)}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-150 relative cursor-pointer group hover:shadow-md ${
                    inCartItem
                      ? "bg-blue-50/60 border-blue-300 ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200 hover:border-blue-400"
                  }`}
                >
                  {inCartItem && (
                    <span className="absolute top-2.5 right-2.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                      {inCartItem.quantity} {inCartItem.unitType}
                    </span>
                  )}

                  <div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-block mb-1.5 ${
                        isKiloan
                          ? "bg-amber-100 text-amber-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {service.unitType.toUpperCase()}
                    </span>
                    <h4 className="font-semibold text-xs text-slate-900 leading-snug line-clamp-2">
                      {service.name}
                    </h4>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">
                      {formatRupiah(service.price)}
                      <span className="text-[10px] font-normal text-slate-400">
                        /{service.unitType}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {service.durationHours}j
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Order Cart & Checkout (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            {/* 1. Customer Identification (CRM) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Pelanggan Cucian
                </label>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    Ganti
                  </button>
                )}
              </div>

              {selectedCustomer ? (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>{selectedCustomer.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      {selectedCustomer.phone}
                    </div>
                    {selectedCustomer.address && (
                      <div className="text-[10px] text-slate-500 truncate max-w-[240px]">
                        {selectedCustomer.address}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      Terpilih
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearchQuery("");
                      }}
                      title="Ganti / Batalkan Pilihan Pelanggan"
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari nama atau nomor HP/WA..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    {searchingCustomer && (
                      <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {/* Customer search results dropdown */}
                  {customerSearchResults.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {customerSearchResults.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearchQuery("");
                            setCustomerSearchResults([]);
                          }}
                          className="p-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-slate-800">{c.name}</div>
                            <div className="text-[11px] text-slate-500">{c.phone}</div>
                            {c.address && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[220px]">
                                {c.address}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* When search has text but no customers found */}
                  {customerSearchQuery.trim().length > 0 && !searchingCustomer && customerSearchResults.length === 0 && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1.5 animate-in fade-in">
                      <p className="text-xs text-slate-500">
                        Tidak ada pelanggan yang cocok dengan <strong className="text-slate-800 font-semibold">"{customerSearchQuery}"</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustName(customerSearchQuery);
                          setShowAddCustomerModal(true);
                        }}
                        className="text-xs text-blue-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Daftarkan "{customerSearchQuery}" sebagai Pelanggan Baru?
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="w-full py-2 px-3 border border-dashed border-blue-400 hover:border-blue-600 bg-blue-50/40 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Tambah Pelanggan Baru
                  </button>
                </div>
              )}
            </div>

            {/* 2. Items in Cart */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                  Rincian Item ({cart.length})
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] text-rose-500 hover:text-rose-700 font-medium"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  Keranjang masih kosong. Pilih layanan di sebelah kiri.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {cart.map((item, idx) => {
                    const isKiloan = item.unitType === "kg";
                    const itemSub = Math.round(item.quantity * item.unitPrice);

                    return (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-slate-900 block leading-tight">
                              {item.serviceName}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {formatRupiah(item.unitPrice)} / {item.unitType}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0">
                            {formatRupiah(itemSub)}
                          </span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, item.quantity - (isKiloan ? 0.5 : 1))}
                              className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <input
                              type="number"
                              step={isKiloan ? "0.01" : "1"}
                              min={isKiloan ? "0.01" : "1"}
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) updateQuantity(idx, val);
                              }}
                              className="w-16 text-center py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-slate-500 font-medium">
                              {item.unitType}
                            </span>

                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, item.quantity + (isKiloan ? 0.5 : 1))}
                              className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quick decimal presets for kiloan */}
                        {isKiloan && (
                          <div className="flex gap-1 overflow-x-auto pt-0.5">
                            {[1, 2, 3, 5, 7].map((presetKg) => (
                              <button
                                key={presetKg}
                                type="button"
                                onClick={() => updateQuantity(idx, presetKg)}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                  item.quantity === presetKg
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {presetKg} kg
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Note per item */}
                        <input
                          type="text"
                          placeholder="Catatan item (contoh: noda di kerah, luntur)..."
                          value={item.note}
                          onChange={(e) => updateItemNote(idx, e.target.value)}
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Estimasi Selesai Card */}
            {cart.length > 0 && (
              <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Estimasi Selesai ({maxDurationHours} jam):
                </span>
                <span className="font-bold text-blue-900">
                  {formatDate(estimatedDoneDate)}
                </span>
              </div>
            )}

            {/* 4. Diskon & Promo Section */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  Promo & Diskon
                </span>
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  {manualDiscount > 0 ? "Ubah Diskon Manual" : "Diskon Khusus"}
                </button>
              </div>

              {/* Promo master select */}
              {promos.length > 0 && (
                <select
                  value={selectedPromoId}
                  onChange={(e) => setSelectedPromoId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Pilih Promo Master (Opsional)...</option>
                  {promos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type === "persen" ? `${p.value}%` : formatRupiah(p.value)})
                    </option>
                  ))}
                </select>
              )}

              {manualDiscount > 0 && (
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs flex justify-between items-center text-amber-900">
                  <div>
                    <span className="font-semibold">
                      Diskon Manual: -{formatRupiah(manualDiscount)}
                    </span>
                    <span className="text-[10px] text-amber-700 block italic">
                      Alasan: &ldquo;{manualDiscountReason}&rdquo;
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setManualDiscountVal("");
                      setManualDiscountReason("");
                      setOwnerPin("");
                    }}
                    className="text-amber-800 font-bold hover:text-rose-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* 5. Pembayaran Termin (Belum Bayar, DP, Lunas) */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Opsi Pembayaran
              </span>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentOption("unpaid")}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    paymentOption === "unpaid"
                      ? "bg-rose-50 border-rose-400 text-rose-800 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Bayar Nanti
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentOption("dp")}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    paymentOption === "dp"
                      ? "bg-amber-50 border-amber-400 text-amber-800 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  DP (Uang Muka)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentOption("full")}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    paymentOption === "full"
                      ? "bg-emerald-50 border-emerald-400 text-emerald-800 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Lunas Sekarang
                </button>
              </div>

              {/* DP Amount Input */}
              {paymentOption === "dp" && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1.5">
                  <label className="text-[11px] font-semibold text-amber-900 block">
                    Nominal DP (Minimal Rp 1 - Maks {formatRupiah(total)})
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-slate-400 text-xs">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={dpAmountInput}
                      onChange={(e) => setDpAmountInput(e.target.value)}
                      placeholder="Contoh: 20000"
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Payment Method (Tunai vs QRIS) if not unpaid */}
              {paymentOption !== "unpaid" && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("tunai")}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        paymentMethod === "tunai"
                          ? "bg-blue-50 border-blue-500 text-blue-800"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      Tunai (Cash)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("qris")}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        paymentMethod === "qris"
                          ? "bg-blue-50 border-blue-500 text-blue-800"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      QRIS / Transfer
                    </button>
                  </div>

                  {paymentMethod === "tunai" ? (
                    <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <label className="font-semibold text-slate-700 block">
                        Uang Tunai Diterima
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-bold text-slate-400 text-xs">
                          Rp
                        </span>
                        <input
                          type="number"
                          value={cashReceivedInput}
                          onChange={(e) => setCashReceivedInput(e.target.value)}
                          placeholder={payAmount.toString()}
                          className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Quick Cash Presets */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => setCashReceivedInput(payAmount.toString())}
                          className="text-[10px] px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700"
                        >
                          Uang Pas
                        </button>
                        {[20000, 50000, 100000, 200000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCashReceivedInput(preset.toString())}
                            className="text-[10px] px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700"
                          >
                            {formatRupiah(preset)}
                          </button>
                        ))}
                      </div>

                      {changeAmount > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold text-emerald-700 text-sm">
                          <span>Kembalian:</span>
                          <span>{formatRupiah(changeAmount)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <label className="font-semibold text-slate-700 block">
                        Referensi Transaksi QRIS (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: No. RRN / Kode Approval..."
                        value={qrisRef}
                        onChange={(e) => setQrisRef(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 6. Total Summary & Submit */}
            <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Diskon Promo:</span>
                  <span>-{formatRupiah(promoDiscount)}</span>
                </div>
              )}
              {manualDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Diskon Khusus:</span>
                  <span>-{formatRupiah(manualDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Tagihan:</span>
                <span className="text-blue-600">{formatRupiah(total)}</span>
              </div>

              {paymentOption !== "unpaid" && (
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Bayar Sekarang:</span>
                  <span>{formatRupiah(payAmount)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold pt-1 border-t border-dotted border-slate-200 text-slate-800">
                <span>Sisa Tagihan:</span>
                <span className={total - payAmount <= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {total - payAmount <= 0 ? "LUNAS" : formatRupiah(total - payAmount)}
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={submitting || cart.length === 0}
                className="w-full mt-3 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan & Mencetak...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Simpan & Cetak Struk (58mm)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Tambah Pelanggan Baru Inline */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Tambah Pelanggan Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nama Lengkap Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: Ibu Rina / Pak Budi"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nomor WhatsApp / HP *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 081234567890"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Format otomatis dinormalisasi ke 62xxxxxxxxxx
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Alamat (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Alamat rumah / patokan lokasi..."
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {savingCustomer ? "Menyimpan..." : "Simpan & Pilih"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Input Diskon Manual & Owner PIN */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-600" />
                Diskon Manual Khusus
              </h3>
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setManualDiscountType("nominal")}
                  className={`py-2 text-center rounded-xl font-semibold border cursor-pointer ${
                    manualDiscountType === "nominal"
                      ? "bg-amber-50 border-amber-400 text-amber-900"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  Nominal (Rp)
                </button>
                <button
                  type="button"
                  onClick={() => setManualDiscountType("persen")}
                  className={`py-2 text-center rounded-xl font-semibold border cursor-pointer ${
                    manualDiscountType === "persen"
                      ? "bg-amber-50 border-amber-400 text-amber-900"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  Persentase (%)
                </button>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nilai Diskon ({manualDiscountType === "nominal" ? "Rupiah" : "Persen"})
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder={manualDiscountType === "nominal" ? "Contoh: 10000" : "Contoh: 15"}
                  value={manualDiscountVal}
                  onChange={(e) => setManualDiscountVal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Alasan Diskon (Wajib minimal 5 karakter) *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Diskon tetangga / Kompensasi cucian..."
                  value={manualDiscountReason}
                  onChange={(e) => setManualDiscountReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Threshold warning & Owner PIN */}
              {isManualDiscountAbove20 && userRole !== "owner" && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Otorisasi Owner Diperlukan (&gt; 20%)</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Diskon ini melebihi ambang batas 20%. Masukkan PIN Owner untuk menyetujui:
                  </p>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="PIN Owner (Default: 1234)"
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (manualDiscountNum > 0 && manualDiscountReason.trim().length < 5) {
                      showToast.warning("Alasan diskon manual minimal 5 karakter.");
                      return;
                    }
                    setShowDiscountModal(false);
                    if (manualDiscountNum > 0) {
                      showToast.success("Diskon manual berhasil diterapkan.");
                    }
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Terapkan Diskon
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
