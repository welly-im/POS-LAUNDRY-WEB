import React, { useState } from "react";
import { Settings, Save, CheckCircle, Store, Receipt, Lock, Phone } from "lucide-react";
import { showToast } from "../lib/dialog";

interface OutletData {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  receiptFooter?: string | null;
}

interface OwnerSettingsManagerProps {
  outlet: OutletData;
  ownerPin?: string | null;
}

export const OwnerSettingsManager: React.FC<OwnerSettingsManagerProps> = ({
  outlet,
  ownerPin,
}) => {
  const [name, setName] = useState(outlet.name);
  const [address, setAddress] = useState(outlet.address || "");
  const [phone, setPhone] = useState(outlet.phone || "");
  const [receiptFooter, setReceiptFooter] = useState(
    outlet.receiptFooter || "Terima kasih telah mencuci di laundry kami!"
  );
  const [pin, setPin] = useState(ownerPin || "1234");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setSaving(true);

    try {
      const res = await fetch("/api/owner/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          phone,
          receiptFooter,
          ownerPin: pin,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal memperbarui pengaturan");
        setSaving(false);
        return;
      }

      setSuccessMsg("Pengaturan profil usaha dan template struk berhasil disimpan!");
      showToast.success("Pengaturan usaha berhasil diperbarui!");
      setNewPassword("");
      setSaving(false);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Profil Usaha */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Profil Usaha Laundry</h3>
              <p className="text-xs text-slate-500">Informasi nama toko dan kontak usaha</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Nama Usaha Laundry *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nomor HP / WhatsApp Toko
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Alamat Lengkap Toko
                </label>
                <input
                  type="text"
                  placeholder="Jl. Merdeka No. 88, Jakarta"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Template Struk Thermal 58mm */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pengaturan Struk Thermal</h3>
              <p className="text-xs text-slate-500">
                Pesan catatan kaki (footer), syarat & ketentuan cucian yang tercetak di kertas struk
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Catatan Kaki Struk (Receipt Footer)
              </label>
              <textarea
                rows={3}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="Pesan terima kasih, batas waktu komplain, tanggung jawab barang luntur..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Tercetak otomatis di bagian paling bawah struk thermal 58mm.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Keamanan & PIN Otorisasi Owner */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Keamanan & Otorisasi Owner</h3>
              <p className="text-xs text-slate-500">
                PIN persetujuan diskon manual &gt; 20% dan ganti password akun pemilik
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                PIN Otorisasi Owner (4-6 Angka)
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Contoh: 1234"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Digunakan kasir saat meminta otorisasi diskon manual di atas 20%.
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Ganti Password Akun Owner
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Kosongkan jika tidak diubah..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan Perubahan..." : "Simpan Semua Pengaturan"}
          </button>
        </div>
      </form>
    </div>
  );
};
