import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import type { DialogType, ToastType } from "../../lib/dialog";

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: DialogType;
  resolve: (value: boolean) => void;
}

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  buttonText: string;
  type: DialogType;
  resolve: () => void;
}

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export const GlobalDialog: React.FC = () => {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [alertDialog, setAlertDialog] = useState<AlertState | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // 1. Listen for Confirm events
    const handleConfirm = (e: Event) => {
      const customEvent = e as CustomEvent;
      const {
        title = "Konfirmasi Tindakan",
        message = "",
        confirmText = "Lanjutkan",
        cancelText = "Batal",
        type = "warning",
        resolve,
      } = customEvent.detail || {};

      setConfirmDialog({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        type,
        resolve,
      });
    };

    // 2. Listen for Alert events
    const handleAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      const {
        title = "Pemberitahuan",
        message = "",
        buttonText = "Mengerti",
        type = "info",
        resolve,
      } = customEvent.detail || {};

      setAlertDialog({
        isOpen: true,
        title,
        message,
        buttonText,
        type,
        resolve: resolve || (() => {}),
      });
    };

    // 3. Listen for Toast events
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, message, type = "info", duration = 3500 } = customEvent.detail || {};
      if (!message) return;

      const newToast: ToastMessage = { id, message, type };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    };

    window.addEventListener("app:confirm", handleConfirm);
    window.addEventListener("app:alert", handleAlert);
    window.addEventListener("app:toast", handleToast);

    // Override browser default window.alert to prevent any native popup
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      window.dispatchEvent(
        new CustomEvent("app:alert", {
          detail: {
            title: "Pemberitahuan",
            message: String(msg ?? ""),
            buttonText: "Tutup",
            type: "warning",
          },
        })
      );
    };

    return () => {
      window.removeEventListener("app:confirm", handleConfirm);
      window.removeEventListener("app:alert", handleAlert);
      window.removeEventListener("app:toast", handleToast);
      window.alert = originalAlert;
    };
  }, []);

  const closeConfirm = (confirmed: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(confirmed);
      setConfirmDialog(null);
    }
  };

  const closeAlert = () => {
    if (alertDialog) {
      alertDialog.resolve();
      setAlertDialog(null);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getTypeStyles = (type: DialogType) => {
    switch (type) {
      case "danger":
        return {
          icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
          iconBg: "bg-rose-100",
          btnColor: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20",
          accentBorder: "border-rose-200",
        };
      case "warning":
        return {
          icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
          iconBg: "bg-amber-100",
          btnColor: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20",
          accentBorder: "border-amber-200",
        };
      case "success":
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
          iconBg: "bg-emerald-100",
          btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20",
          accentBorder: "border-emerald-200",
        };
      case "info":
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-600" />,
          iconBg: "bg-blue-100",
          btnColor: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20",
          accentBorder: "border-blue-200",
        };
    }
  };

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-emerald-700 text-white border-emerald-800",
          icon: <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />,
        };
      case "error":
        return {
          bg: "bg-rose-700 text-white border-rose-800",
          icon: <AlertCircle className="w-5 h-5 shrink-0 text-rose-200" />,
        };
      case "warning":
        return {
          bg: "bg-amber-600 text-white border-amber-700",
          icon: <AlertTriangle className="w-5 h-5 shrink-0 text-amber-200" />,
        };
      case "info":
      default:
        return {
          bg: "bg-slate-800 text-white border-slate-900",
          icon: <Info className="w-5 h-5 shrink-0 text-blue-300" />,
        };
    }
  };

  return (
    <>
      {/* 1. Modal Confirm Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  getTypeStyles(confirmDialog.type).iconBg
                }`}
              >
                {getTypeStyles(confirmDialog.type).icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {confirmDialog.title}
                </h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                  getTypeStyles(confirmDialog.type).btnColor
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Alert Dialog */}
      {alertDialog && alertDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  getTypeStyles(alertDialog.type).iconBg
                }`}
              >
                {getTypeStyles(alertDialog.type).icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {alertDialog.title}
                </h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {alertDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={closeAlert}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                  getTypeStyles(alertDialog.type).btnColor
                }`}
              >
                {alertDialog.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Floating Toasts */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const style = getToastStyles(toast.type);
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200 ${style.bg}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {style.icon}
                <span className="truncate leading-snug">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
};
