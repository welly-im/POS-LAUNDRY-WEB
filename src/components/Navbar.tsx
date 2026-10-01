import React, { useState } from "react";
import {
  ShoppingBag,
  Clock,
  Users,
  BarChart3,
  LogOut,
  Settings,
  Layers,
  Tag,
  UserCheck,
  Menu,
  X,
  Coins,
  Receipt
} from "lucide-react";
import { showConfirm } from "../lib/dialog";

interface NavbarProps {
  currentPath: string;
  user: {
    fullName: string;
    username: string;
    role: "owner" | "kasir";
  };
  outlet: {
    name: string;
  };
  activeShift?: {
    id: string;
    openedAt: string;
  } | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  user,
  outlet,
  activeShift,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);

  const isOwner = user.role === "owner";

  const navLinks = [
    { name: "POS / Order Baru", href: "/pos", icon: ShoppingBag },
    { name: "Daftar Pesanan", href: "/orders", icon: Clock },
    { name: "Pelanggan", href: "/customers", icon: Users },
    {
      name: "Shift Kasir",
      href: "/shifts",
      icon: Coins,
      badge: activeShift ? "Aktif" : "Tutup",
      badgeColor: activeShift
        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
        : "bg-amber-100 text-amber-800 border-amber-300",
    },
  ];

  const ownerLinks = [
    { name: "Ringkasan & Laporan", href: "/owner", icon: BarChart3 },
    { name: "Master Layanan", href: "/owner/services", icon: Layers },
    { name: "Master Promo", href: "/owner/promos", icon: Tag },
    { name: "Kelola Karyawan", href: "/owner/users", icon: UserCheck },
    { name: "Pengaturan Usaha", href: "/owner/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: "Konfirmasi Logout",
      message: "Apakah Anda yakin ingin keluar dari sistem POS Laundry?",
      confirmText: "Ya, Keluar",
      cancelText: "Batal",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
      });
    } catch (err) {
      console.error("Logout request error:", err);
    }
    // Force cookie deletion on client side as an extra safeguard
    document.cookie =
      "pos_laundry_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;";
    // Navigate to /logout which terminates session on server and redirects cleanly to /login?logout=true
    window.location.href = "/logout";
  };

  return (
    <header className="no-print sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <a href={isOwner ? "/owner" : "/pos"} className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 tracking-tight block leading-tight">
                  {outlet.name}
                </span>
                <span className="text-[11px] font-medium text-slate-500 block uppercase tracking-wider">
                  Sistem Kasir Laundry
                </span>
              </div>
            </a>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentPath === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.name}</span>
                  {link.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${link.badgeColor}`}
                    >
                      {link.badge}
                    </span>
                  )}
                </a>
              );
            })}

            {/* Owner Dropdown */}
            {isOwner && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOwnerDropdownOpen(!ownerDropdownOpen)}
                  onBlur={() => setTimeout(() => setOwnerDropdownOpen(false), 200)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    currentPath.startsWith("/owner")
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Kelola & Laporan</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-1.5 py-0.5 rounded-full border border-indigo-200">
                    Owner
                  </span>
                </button>

                {ownerDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                      Menu Pemilik
                    </div>
                    {ownerLinks.map((item) => {
                      const ItemIcon = item.icon;
                      const isItemActive = currentPath === item.href;
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${
                            isItemActive
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <ItemIcon className="w-4 h-4 text-slate-500" />
                          <span>{item.name}</span>
                        </a>
                      );
                    })}

                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User profile & Logout */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-800">
                {user.fullName}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    isOwner ? "bg-indigo-500" : "bg-emerald-500"
                  }`}
                />
                <span className="text-[11px] text-slate-500 capitalize">
                  {user.role} ({user.username})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Keluar dari sistem"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shadow-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {user.fullName}
              </div>
              <div className="text-xs text-slate-500 capitalize">
                Peran: <strong className="text-blue-600">{user.role}</strong> ({user.username})
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
              Menu Utama
            </div>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentPath === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{link.name}</span>
                  </div>
                  {link.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${link.badgeColor}`}
                    >
                      {link.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>

          {isOwner && (
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                Manajemen & Laporan (Owner)
              </div>
              {ownerLinks.map((link) => {
                const Icon = link.icon;
                const isActive = currentPath === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-slate-500" />
                    <span>{link.name}</span>
                  </a>
                );
              })}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Keluar dari Akun Owner</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
