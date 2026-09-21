"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const TONE_CLASSES: Record<ToastType, string> = {
  success: "border-success/40 text-success",
  error: "border-danger/40 text-danger",
  info: "border-info/40 text-info",
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
            {toasts.map((toast) => {
              const Icon = ICONS[toast.type];
              return (
                <div
                  key={toast.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-btn border bg-surface px-4 py-3 text-sm text-text shadow-lg animate-fadeIn",
                    TONE_CLASSES[toast.type]
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{toast.message}</span>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
