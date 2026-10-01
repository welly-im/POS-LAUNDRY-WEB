export type DialogType = "info" | "warning" | "danger" | "success";

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: DialogType;
}

export interface AlertDialogOptions {
  title?: string;
  message: string;
  buttonText?: string;
  type?: DialogType;
}

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

/**
 * Show a modern confirmation dialog. Returns a Promise resolving to true (confirmed) or false (cancelled).
 */
export function showConfirm(options: ConfirmDialogOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(
      new CustomEvent("app:confirm", {
        detail: {
          ...options,
          resolve,
        },
      })
    );
  });
}

/**
 * Show a modern alert dialog. Returns a Promise resolving when closed.
 */
export function showAlert(options: AlertDialogOptions | string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const opts: AlertDialogOptions =
    typeof options === "string" ? { message: options } : options;

  return new Promise<void>((resolve) => {
    window.dispatchEvent(
      new CustomEvent("app:alert", {
        detail: {
          ...opts,
          resolve,
        },
      })
    );
  });
}

/**
 * Show a floating toast notification.
 */
export function showToast(message: string, type: ToastType = "info", duration: number = 3500) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: {
        id: Math.random().toString(36).substring(2, 9),
        message,
        type,
        duration,
      },
    })
  );
}

showToast.success = (message: string, duration?: number) => showToast(message, "success", duration);
showToast.error = (message: string, duration?: number) => showToast(message, "error", duration);
showToast.warning = (message: string, duration?: number) => showToast(message, "warning", duration);
showToast.info = (message: string, duration?: number) => showToast(message, "info", duration);
