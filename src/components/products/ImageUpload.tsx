"use client";

import { ChangeEvent, useRef } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface ImageUploadProps {
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  error?: string;
  label?: string;
  alt?: string;
  size?: number;
  rounded?: "btn" | "full";
}

export default function ImageUpload({
  previewUrl,
  onSelect,
  onRemove,
  error,
  label = "Foto do produto",
  alt = "Foto",
  size = 128,
  rounded = "btn",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const roundedClass = rounded === "full" ? "rounded-full" : "rounded-btn";

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    if (file.size > MAX_SIZE_BYTES) return;
    onSelect(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm text-textDim">{label}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />
      {previewUrl ? (
        <div className="relative" style={{ width: size, height: size }}>
          <img
            src={previewUrl}
            alt={alt}
            className={cn("h-full w-full border border-border object-cover", roundedClass)}
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover foto"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-textDim transition duration-200 hover:border-danger hover:text-danger"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{ width: size, height: size }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 border border-dashed border-border text-textDim transition duration-200 hover:border-gold hover:text-gold",
            roundedClass
          )}
        >
          <Camera size={22} strokeWidth={1.5} />
          <span className="text-xs">Adicionar foto</span>
        </button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
