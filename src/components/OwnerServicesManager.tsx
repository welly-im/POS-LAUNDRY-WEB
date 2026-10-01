import React, { useState } from "react";
import { formatRupiah } from "../lib/format";
import { showToast } from "../lib/dialog";
import {
  Layers,
  Plus,
  Edit2,
  Clock,
  CheckCircle,
  XCircle,
  Tag,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

interface ServiceCategory {
  id: string;
  name: string;
  isActive: boolean;
}

interface Service {
  id: string;
  categoryId: string;
  name: string;
  unitType: "kg" | "pcs";
  price: number;
  durationHours: number;
  isActive: boolean;
}

interface OwnerServicesManagerProps {
  initialCategories: ServiceCategory[];
  initialServices: Service[];
}

export const OwnerServicesManager: React.FC<OwnerServicesManagerProps> = ({
  initialCategories,
  initialServices,
}) => {
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories);
  const [services, setServices] = useState<Service[]>(initialServices);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Category Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [catNameInput, setCatNameInput] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  // Service Modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [srvName, setSrvName] = useState("");
  const [srvCatId, setSrvCatId] = useState("");
  const [srvUnitType, setSrvUnitType] = useState<"kg" | "pcs">("kg");
  const [srvPrice, setSrvPrice] = useState("");
  const [srvDuration, setSrvDuration] = useState("24");
  const [srvIsActive, setSrvIsActive] = useState(true);
  const [savingService, setSavingService] = useState(false);

  const filteredServices = services.filter(
    (s) => selectedCategoryFilter === "all" || s.categoryId === selectedCategoryFilter
  );

  const openAddServiceModal = () => {
    setEditServiceId(null);
    setSrvName("");
    setSrvCatId(categories[0]?.id || "");
    setSrvUnitType("kg");
    setSrvPrice("");
    setSrvDuration("24");
    setSrvIsActive(true);
    setShowServiceModal(true);
  };

  const openEditServiceModal = (s: Service) => {
    setEditServiceId(s.id);
    setSrvName(s.name);
    setSrvCatId(s.categoryId);
    setSrvUnitType(s.unitType);
    setSrvPrice(s.price.toString());
    setSrvDuration(s.durationHours.toString());
    setSrvIsActive(s.isActive);
    setShowServiceModal(true);
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameInput.trim()) return;

    setSavingCat(true);
    try {
      const res = await fetch("/api/owner/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_category", name: catNameInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal menambah kategori");
        setSavingCat(false);
        return;
      }

      setCategories((prev) => [...prev, data.category]);
      setShowCatModal(false);
      setCatNameInput("");
      showToast.success(`Kategori "${data.category.name}" berhasil ditambahkan!`);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setSavingCat(false);
    }
  };

  // Save Service
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingService(true);

    try {
      const action = editServiceId ? "update_service" : "create_service";
      const payload: any = {
        action,
        name: srvName,
        categoryId: srvCatId,
        unitType: srvUnitType,
        price: parseInt(srvPrice.replace(/\D/g, "") || "0", 10),
        durationHours: parseInt(srvDuration || "24", 10),
        isActive: srvIsActive,
      };
      if (editServiceId) payload.id = editServiceId;

      const res = await fetch("/api/owner/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal menyimpan layanan");
        setSavingService(false);
        return;
      }

      if (editServiceId) {
        setServices((prev) =>
          prev.map((s) => (s.id === editServiceId ? data.service : s))
        );
        showToast.success("Layanan berhasil diperbarui!");
      } else {
        setServices((prev) => [...prev, data.service]);
        showToast.success("Layanan baru berhasil ditambahkan!");
      }

      setShowServiceModal(false);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setSavingService(false);
    }
  };

  const toggleServiceActive = async (s: Service) => {
    try {
      const res = await fetch("/api/owner/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_service",
          id: s.id,
          isActive: !s.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setServices((prev) =>
          prev.map((item) => (item.id === s.id ? { ...item, isActive: !s.isActive } : item))
        );
        showToast.success(`Layanan "${s.name}" ${!s.isActive ? "diaktifkan" : "dinonaktifkan"}`);
      } else {
        showToast.error(data.error || "Gagal mengubah status layanan");
      }
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Action Buttons */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter("all")}
            className={`py-1.5 px-3 rounded-lg font-medium cursor-pointer transition-colors ${
              selectedCategoryFilter === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua ({services.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategoryFilter(c.id)}
              className={`py-1.5 px-3 rounded-lg font-medium cursor-pointer whitespace-nowrap transition-colors ${
                selectedCategoryFilter === c.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCatModal(true)}
            className="py-2 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Kategori
          </button>

          <button
            type="button"
            onClick={openAddServiceModal}
            className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Layanan
          </button>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Nama Layanan</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-center">Tipe Unit</th>
                <th className="py-3 px-4 text-right">Tarif Harga</th>
                <th className="py-3 px-4 text-center">Estimasi Pengerjaan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Belum ada layanan di kategori ini.
                  </td>
                </tr>
              ) : (
                filteredServices.map((s) => {
                  const cat = categories.find((c) => c.id === s.categoryId);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {s.name}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {cat?.name || "-"}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            s.unitType === "kg"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {s.unitType}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatRupiah(s.price)}
                      </td>

                      <td className="py-3 px-4 text-center font-medium">
                        {s.durationHours} Jam
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleServiceActive(s)}
                          className="cursor-pointer"
                          title="Klik untuk ubah status aktif/nonaktif"
                        >
                          {s.isActive ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Nonaktif
                            </span>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => openEditServiceModal(s)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Tambah Kategori */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Tambah Kategori Layanan</h3>
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: Helm & Aksesoris"
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  {savingCat ? "Menyimpan..." : "Simpan Kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah / Edit Layanan */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editServiceId ? "Ubah Layanan" : "Tambah Layanan Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowServiceModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nama Layanan *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: Cuci Kering Lipat Express"
                  value={srvName}
                  onChange={(e) => setSrvName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Kategori *
                </label>
                <select
                  required
                  value={srvCatId}
                  onChange={(e) => setSrvCatId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tipe Unit *
                  </label>
                  <select
                    value={srvUnitType}
                    onChange={(e) => setSrvUnitType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="kg">Kiloan (kg)</option>
                    <option value="pcs">Satuan (pcs)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tarif Harga (Rp) *
                  </label>
                  <input
                    type="number"
                    min="100"
                    required
                    placeholder="Contoh: 10000"
                    value={srvPrice}
                    onChange={(e) => setSrvPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Durasi Pengerjaan (Jam) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Contoh: 48"
                  value={srvDuration}
                  onChange={(e) => setSrvDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Digunakan untuk menghitung estimasi tanggal selesai secara otomatis.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={srvIsActive}
                  onChange={(e) => setSrvIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="isActiveToggle" className="font-semibold text-slate-700">
                  Layanan Aktif (Bisa dipilih di Kasir)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingService}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  {savingService ? "Menyimpan..." : "Simpan Layanan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
