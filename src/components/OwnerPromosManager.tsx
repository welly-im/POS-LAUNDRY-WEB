import React, { useState } from "react";
import { formatRupiah } from "../lib/format";
import { showToast } from "../lib/dialog";
import { Tag, Plus, Edit2, CheckCircle2, XCircle } from "lucide-react";

interface PromoItem {
  id: string;
  name: string;
  type: "persen" | "nominal";
  value: number;
  minSpend: number | null;
  isActive: boolean;
}

interface OwnerPromosManagerProps {
  initialPromos: PromoItem[];
}

export const OwnerPromosManager: React.FC<OwnerPromosManagerProps> = ({
  initialPromos,
}) => {
  const [promos, setPromos] = useState<PromoItem[]>(initialPromos);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [promoName, setPromoName] = useState("");
  const [promoType, setPromoType] = useState<"persen" | "nominal">("persen");
  const [promoVal, setPromoVal] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openAddModal = () => {
    setEditId(null);
    setPromoName("");
    setPromoType("persen");
    setPromoVal("");
    setMinSpend("");
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (p: PromoItem) => {
    setEditId(p.id);
    setPromoName(p.name);
    setPromoType(p.type);
    setPromoVal(p.value.toString());
    setMinSpend(p.minSpend ? p.minSpend.toString() : "");
    setIsActive(p.isActive);
    setShowModal(true);
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const action = editId ? "update" : "create";
      const payload: any = {
        action,
        name: promoName,
        type: promoType,
        value: parseInt(promoVal.replace(/\D/g, "") || "0", 10),
        minSpend: minSpend ? parseInt(minSpend.replace(/\D/g, "") || "0", 10) : 0,
        isActive,
      };
      if (editId) payload.id = editId;

      const res = await fetch("/api/owner/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal menyimpan promo");
        setSaving(false);
        return;
      }

      if (editId) {
        setPromos((prev) => prev.map((p) => (p.id === editId ? data.promo : p)));
        showToast.success("Promo diskon berhasil diperbarui!");
      } else {
        setPromos((prev) => [...prev, data.promo]);
        showToast.success("Promo diskon baru berhasil disimpan!");
      }

      setShowModal(false);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setSaving(false);
    }
  };

  const togglePromoActive = async (p: PromoItem) => {
    try {
      const res = await fetch("/api/owner/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: p.id,
          isActive: !p.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPromos((prev) =>
          prev.map((item) => (item.id === p.id ? { ...item, isActive: !p.isActive } : item))
        );
        showToast.success(`Promo "${p.name}" ${!p.isActive ? "diaktifkan" : "dinonaktifkan"}`);
      } else {
        showToast.error(data.error || "Gagal mengubah status promo");
      }
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Daftar Promo Diskon</h3>
          <p className="text-xs text-slate-500">Kelola promo potongan harga yang dapat diterapkan kasir</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Tambah Promo Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Nama Promo</th>
                <th className="py-3 px-4">Tipe Diskon</th>
                <th className="py-3 px-4 text-right">Besaran Potongan</th>
                <th className="py-3 px-4 text-right">Min. Belanja</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Belum ada promo master yang dibuat.
                  </td>
                </tr>
              ) : (
                promos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize">{p.type}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {p.type === "persen" ? `${p.value}%` : formatRupiah(p.value)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {p.minSpend && p.minSpend > 0 ? formatRupiah(p.minSpend) : "Tanpa Minimum"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => togglePromoActive(p)}
                        className="cursor-pointer"
                      >
                        {p.isActive ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Aktif
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Nonaktif
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Promo Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {promos.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Belum ada promo master yang dibuat.
            </div>
          ) : (
            promos.map((p) => (
              <div key={p.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900">{p.name}</div>
                  <button
                    type="button"
                    onClick={() => togglePromoActive(p)}
                    className="cursor-pointer"
                  >
                    {p.isActive ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        Aktif
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        Nonaktif
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Nilai Diskon:</span>
                    <span className="font-extrabold text-sm text-emerald-600">
                      {p.type === "persen" ? `${p.value}%` : formatRupiah(p.value)} ({p.type})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Min. Belanja:</span>
                    <span className="font-semibold text-slate-700">
                      {p.minSpend && p.minSpend > 0 ? formatRupiah(p.minSpend) : "Tanpa Minimum"}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openEditModal(p)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Promo</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Add/Edit Promo */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editId ? "Ubah Promo" : "Tambah Promo Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePromo} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nama Promo *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: Diskon Pelanggan Baru 10%"
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tipe Diskon *
                  </label>
                  <select
                    value={promoType}
                    onChange={(e) => setPromoType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="persen">Persentase (%)</option>
                    <option value="nominal">Nominal (Rp)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Nilai Potongan *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder={promoType === "persen" ? "Contoh: 10" : "Contoh: 5000"}
                    value={promoVal}
                    onChange={(e) => setPromoVal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Minimum Belanja (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Contoh: 30000 (Kosongkan jika tanpa minimum)"
                  value={minSpend}
                  onChange={(e) => setMinSpend(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="promoActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="promoActiveCheck" className="font-semibold text-slate-700">
                  Promo Aktif
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  {saving ? "Menyimpan..." : "Simpan Promo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
