"use client";

import { TouchEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ClienteFoto } from "@/lib/types/database";

interface PhotoLightboxProps {
  photos: ClienteFoto[];
  /** storage_path -> signed URL (mesmas usadas nas miniaturas — bucket privado). */
  imageUrls: Record<string, string>;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onDownload: (photo: ClienteFoto) => void;
  onDelete: (photo: ClienteFoto) => void;
  busyId: string | null;
}

const SWIPE_THRESHOLD = 50;

/** Visualização ampliada de uma foto do cliente, com navegação entre as fotos da mesma seção. */
export default function PhotoLightbox({
  photos,
  imageUrls,
  index,
  onClose,
  onIndexChange,
  onDownload,
  onDelete,
  busyId,
}: PhotoLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const photo = photos[index];
  const hasMultiple = photos.length > 1;

  function goPrev() {
    onIndexChange((index - 1 + photos.length) % photos.length);
  }

  function goNext() {
    onIndexChange((index + 1) % photos.length);
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMultiple) goPrev();
      else if (e.key === "ArrowRight" && hasMultiple) goNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, hasMultiple]);

  function handleTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (!hasMultiple) return;
    if (delta > SWIPE_THRESHOLD) goPrev();
    else if (delta < -SWIPE_THRESHOLD) goNext();
  }

  if (!mounted || !photo) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 animate-fadeInOverlay"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition duration-200 hover:bg-white/20"
      >
        <X size={20} />
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition duration-200 hover:bg-white/20 sm:left-4"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Próxima foto"
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition duration-200 hover:bg-white/20 sm:right-4"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <div
        className="flex max-h-full w-full max-w-3xl flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden rounded-card">
          {imageUrls[photo.storage_path] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrls[photo.storage_path]}
              alt={photo.nome}
              className="max-h-[75vh] w-auto max-w-full select-none object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center text-white/60">
              Carregando...
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="text-sm font-medium text-white">{photo.nome}</p>
          <p className="text-xs text-white/60">{formatDate(new Date(photo.created_at))}</p>
          {hasMultiple && (
            <p className="text-xs text-white/40">
              {index + 1} de {photos.length}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onDownload(photo)}
            disabled={busyId === photo.id}
            className="inline-flex items-center gap-2 rounded-btn bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition duration-200 hover:bg-primary-dark disabled:opacity-50"
          >
            <Download size={16} />
            Baixar
          </button>
          <button
            type="button"
            onClick={() => onDelete(photo)}
            disabled={busyId === photo.id}
            className="inline-flex items-center gap-2 rounded-btn bg-danger px-4 py-2.5 text-sm font-medium text-white transition duration-200 hover:brightness-110 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Excluir
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
