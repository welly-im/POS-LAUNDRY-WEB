import React, { useState } from "react";
import { formatDate } from "../lib/format";
import { showToast, showConfirm } from "../lib/dialog";
import { UserCheck, Plus, Key, Shield, User, CheckCircle2, XCircle } from "lucide-react";

interface UserItem {
  id: string;
  username: string;
  email?: string | null;
  fullName: string;
  role: "owner" | "kasir";
  pin?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface OwnerUsersManagerProps {
  initialUsers: UserItem[];
  currentUserId: string;
}

export const OwnerUsersManager: React.FC<OwnerUsersManagerProps> = ({
  initialUsers,
  currentUserId,
}) => {
  const [usersList, setUsersList] = useState<UserItem[]>(initialUsers);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"kasir" | "owner">("kasir");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset password modal state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          username,
          fullName,
          email,
          password,
          role,
          pin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal membuat akun");
        setSaving(false);
        return;
      }

      setUsersList((prev) => [...prev, data.user]);
      setShowAddModal(false);
      setUsername("");
      setFullName("");
      setEmail("");
      setPassword("");
      setPin("");
      showToast.success(`Akun pengguna "${data.user.fullName}" berhasil dibuat!`);
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: UserItem) => {
    if (u.id === currentUserId) {
      showToast.warning("Anda tidak dapat menonaktifkan akun sendiri.");
      return;
    }

    if (u.isActive) {
      const confirmed = await showConfirm({
        title: "Nonaktifkan Akun Pengguna",
        message: `Apakah Anda yakin ingin menonaktifkan akun ${u.fullName} (${u.username})? Pengguna ini tidak akan dapat login lagi.`,
        confirmText: "Ya, Nonaktifkan",
        cancelText: "Batal",
        type: "danger",
      });
      if (!confirmed) return;
    }

    try {
      const res = await fetch("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          id: u.id,
          isActive: !u.isActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setUsersList((prev) =>
          prev.map((item) => (item.id === u.id ? { ...item, isActive: !u.isActive } : item))
        );
        showToast.success(`Akun ${u.fullName} berhasil ${!u.isActive ? "diaktifkan" : "dinonaktifkan"}`);
      } else {
        showToast.error(data.error || "Gagal memperbarui status akun");
      }
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId || !newPassword) return;

    setResetting(true);
    try {
      const res = await fetch("/api/owner/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          id: resetUserId,
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast.error(data.error || "Gagal mereset password");
        setResetting(false);
        return;
      }

      showToast.success("Password akun berhasil direset!");
      setResetUserId(null);
      setNewPassword("");
    } catch (err) {
      showToast.error("Koneksi ke server gagal.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Kelola Akun Kasir & Karyawan</h3>
          <p className="text-xs text-slate-500">
            Atur hak akses login, role kasir/owner, dan status keaktifan staf laundry
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Tambah Akun Karyawan
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Username / Email</th>
                <th className="py-3 px-4 text-center">Peran (Role)</th>
                <th className="py-3 px-4 text-center">PIN Otorisasi</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {u.fullName}
                    {u.id === currentUserId && (
                      <span className="ml-1.5 text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-md">
                        Akun Anda
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{u.username}</div>
                    {u.email && <div className="text-[10px] text-slate-400">{u.email}</div>}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.role === "owner"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                    {u.pin ? "••••" : "-"}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      disabled={u.id === currentUserId}
                      onClick={() => handleToggleActive(u)}
                      className="cursor-pointer disabled:opacity-50"
                    >
                      {u.isActive ? (
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
                      onClick={() => setResetUserId(u.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Reset Sandi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Tambah Karyawan */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Tambah Akun Karyawan / Kasir</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Contoh: Rian Pratama"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: kasir2"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Peran (Role) *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="kasir">Kasir</option>
                    <option value="owner">Owner (Admin Penuh)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="Contoh: kasir2@poslaundry.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Password Awal *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    PIN Cepat (4-6 Angka)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="Contoh: 1234"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  {saving ? "Menyimpan..." : "Buat Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Reset Sandi Pengguna</h3>
              <button
                type="button"
                onClick={() => setResetUserId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Password Baru *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Minimal 5 karakter..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetUserId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  {resetting ? "Menyimpan..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
