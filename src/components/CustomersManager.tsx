import React, { useState, useMemo } from "react";
import { formatRupiah, formatDate, generateWhatsAppUrl } from "../lib/format";
import { showToast } from "../lib/dialog";
import {
  Users,
  Search,
  UserPlus,
  Phone,
  MapPin,
  Clock,
  Edit2,
  ExternalLink,
  MessageCircle,
  ShoppingBag,
  ChevronRight
} from "lucide-react";

interface CustomerWithOrders {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  note?: string | null;
  createdAt: string;
  orders: Array<{
    id: string;
    invoiceNo: string;
    createdAt: string;
    status: string;
    total: number;
    paidAmount: number;
  }>;
}

interface CustomersManagerProps {
  initialCustomers: CustomerWithOrders[];
  outletName: string;
}

export const CustomersManager: React.FC<CustomersManagerProps> = ({
  initialCustomers,
  outletName,
}) => {
  const [customersList, setCustomersList] = useState<CustomerWithOrders[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");

  // Customer History Drawer
  const [activeCustomer, setActiveCustomer] = useState<CustomerWithOrders | null>(null);

  // Add / Edit Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredCustomers = useMemo(() => {
    return customersList.filter((c) => {
      const q = searchQuery.toLowerCase();
      return (
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    });
  }, [customersList, searchQuery]);

  const openAddModal = () => {
    setEditId(null);
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setFormNote("");
    setShowFormModal(true);
  };

  const openEditModal = (c: CustomerWithOrders) => {
    setEditId(c.id);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormAddress(c.address || "");
    setFormNote(c.note || "");
    setShowFormModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const endpoint = editId ? "/api/customers/update" : "/api/customers/create";
      const payload: any = {
        name: formName,
        phone: formPhone,
        address: formAddress,
        note: formNote,
      };
      if (editId) payload.id = editId;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal menyimpan data pelanggan");
        setSaving(false);
        return;
      }

      if (editId) {
        setCustomersList((prev) =>
          prev.map((c) =>
            c.id === editId
              ? {
                  ...c,
                  name: data.customer.name,
                  phone: data.customer.phone,
                  address: data.customer.address,
                  note: data.customer.note,
                }
              : c
          )
        );
        if (activeCustomer && activeCustomer.id === editId) {
          setActiveCustomer({
            ...activeCustomer,
            name: data.customer.name,
            phone: data.customer.phone,
            address: data.customer.address,
            note: data.customer.note,
          });
        }
        showToast.success("Data pelanggan berhasil diperbarui!");
      } else {
        setCustomersList((prev) => [
          {
            ...data.customer,
            orders: [],
          },
          ...prev,
        ]);
        showToast.success("Pelanggan baru berhasil didaftarkan!");
      }

      setShowFormModal(false);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Search & Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari pelanggan berdasarkan nama, nomor HP/WA, atau alamat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Tambah Pelanggan Baru
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4">Kontak WhatsApp</th>
                <th className="py-3 px-4">Alamat</th>
                <th className="py-3 px-4 text-center">Total Order</th>
                <th className="py-3 px-4 text-right">Total Belanja</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Tidak ditemukan data pelanggan.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const totalSpent = cust.orders.reduce((acc, o) => acc + o.total, 0);

                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      onClick={() => setActiveCustomer(cust)}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {cust.name}
                        {cust.note && (
                          <span className="block text-[10px] text-slate-400 font-normal italic">
                            {cust.note}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{cust.phone}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-slate-500">
                        {cust.address || "-"}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-[10px]">
                          {cust.orders.length} Order
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatRupiah(totalSpent)}
                      </td>

                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <a
                            href={generateWhatsAppUrl(
                              cust.phone,
                              `Halo Kak ${cust.name}, terima kasih telah mempercayakan laundry Anda di *${outletName}*! Ada yang bisa kami bantu? 😊`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat WhatsApp"
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>

                          <button
                            type="button"
                            onClick={() => openEditModal(cust)}
                            title="Edit Data Pelanggan"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveCustomer(cust)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold text-xs cursor-pointer"
                          >
                            Riwayat
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

        {/* Mobile View: Customers Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Tidak ditemukan data pelanggan.
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const totalSpent = cust.orders.reduce((acc, o) => acc + o.total, 0);

              return (
                <div
                  key={cust.id}
                  className="p-4 space-y-2 hover:bg-blue-50/30 transition-colors cursor-pointer"
                  onClick={() => setActiveCustomer(cust)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{cust.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{cust.phone}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-sm text-slate-900">{formatRupiah(totalSpent)}</div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {cust.orders.length} pesanan
                      </div>
                    </div>
                  </div>

                  {cust.address && (
                    <div className="text-[11px] text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.address}</span>
                    </div>
                  )}

                  {cust.note && (
                    <div className="text-[10px] text-amber-700 italic bg-amber-50/60 px-2 py-0.5 rounded border border-amber-200">
                      Catatan: {cust.note}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={generateWhatsAppUrl(
                        cust.phone,
                        `Halo Kak ${cust.name}, terima kasih telah mempercayakan laundry Anda di *${outletName}*! Ada yang bisa kami bantu? 😊`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px] bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chat WA</span>
                    </a>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(cust)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCustomer(cust)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Riwayat &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CUSTOMER ORDER HISTORY DRAWER */}
      {activeCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Riwayat Order Pelanggan
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {activeCustomer.name}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {activeCustomer.phone}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCustomer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List Orders */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 text-xs">
              {activeCustomer.orders.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  Pelanggan ini belum pernah melakukan pemesanan.
                </div>
              ) : (
                activeCustomer.orders.map((ord) => {
                  const rem = ord.total - ord.paidAmount;
                  return (
                    <div
                      key={ord.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-700">{ord.invoiceNo}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white border">
                          {ord.status}
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Tanggal:</span>
                        <span>{formatDate(ord.createdAt)}</span>
                      </div>

                      <div className="flex justify-between font-semibold pt-1 border-t border-slate-200">
                        <span>Total Tagihan:</span>
                        <span className="text-slate-900">{formatRupiah(ord.total)}</span>
                      </div>

                      <div className="flex justify-between font-bold text-[11px]">
                        <span>Status Bayar:</span>
                        <span className={rem <= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {rem <= 0 ? "Lunas" : `Sisa: ${formatRupiah(rem)}`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Total: {activeCustomer.orders.length} Transaksi
              </span>
              <button
                type="button"
                onClick={() => setActiveCustomer(null)}
                className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Tambah / Edit Pelanggan */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {editId ? "Ubah Data Pelanggan" : "Tambah Pelanggan Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: Pak Herman"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Alamat
                </label>
                <textarea
                  rows={2}
                  placeholder="Alamat rumah / domisili..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Catatan Khusus Pelanggan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Langganan cuci sepatu / alergi parfum tertentu..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  {saving ? "Menyimpan..." : "Simpan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
