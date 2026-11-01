"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Toast = { message: string; tone: "success" | "error" };
const ToastContext = createContext<((message: string, tone?: Toast["tone"]) => void) | null>(null);

export function useAdminToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("Admin toast provider is missing.");
  return showToast;
}

export default function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);
  const showToast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast ? (
        <div data-admin-toast role={toast.tone === "error" ? "alert" : "status"}
          aria-atomic="true"
          className={`fixed bottom-6 right-4 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-4 rounded-xl border px-5 py-4 text-sm font-medium shadow-lg sm:right-6 ${
            toast.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"
          }`}>
          <span>{toast.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={dismiss}
            className="rounded px-2 py-1 text-lg leading-none focus-visible:outline focus-visible:outline-2">×</button>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
