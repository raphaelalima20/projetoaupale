"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-overlay/60 animate-fadeInOverlay" onClick={onClose} />
      <div className="relative z-10 flex max-h-[95vh] w-full max-w-[95vw] flex-col rounded-card border border-border bg-surface shadow-modal animate-fadeIn sm:max-h-[90vh] sm:max-w-md">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          {title && <h2 className="text-lg font-display text-text">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto rounded-btn p-1.5 text-textDim transition duration-200 hover:bg-surface2 hover:text-text"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer && (
          <div className="flex shrink-0 justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
