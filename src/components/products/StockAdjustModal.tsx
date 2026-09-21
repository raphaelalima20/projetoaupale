"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types/database";

interface StockAdjustModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: Product | null;
}

type Mode = "set" | "add";

export default function StockAdjustModal({ open, onClose, onSaved, product }: StockAdjustModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>("set");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setMode("set");
    setValue(String(product.stock_quantity));
    setError("");
  }, [open, product]);

  if (!product) return null;

  const amount = Number(value);
  const resultingStock = mode === "set" ? amount : product.stock_quantity + amount;

  async function handleSubmit() {
    if (value === "" || Number.isNaN(amount)) {
      setError("Informe um número válido.");
      return;
    }
    if (resultingStock < 0) {
      setError("O estoque resultante não pode ser negativo.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_quantity: resultingStock })
      .eq("id", product!.id);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    showToast("Estoque atualizado");
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajustar Estoque">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-text">{product.name}</p>
          <p className="mt-1 text-xs text-textDim">Estoque atual: {product.stock_quantity} unidades</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("set")}
            className={cn(
              "rounded-btn border px-3 py-2 text-sm transition duration-200",
              mode === "set"
                ? "border-gold bg-gold-dim text-gold-light"
                : "border-border text-textDim hover:border-gold/50 hover:text-text"
            )}
          >
            Definir valor
          </button>
          <button
            type="button"
            onClick={() => setMode("add")}
            className={cn(
              "rounded-btn border px-3 py-2 text-sm transition duration-200",
              mode === "add"
                ? "border-gold bg-gold-dim text-gold-light"
                : "border-border text-textDim hover:border-gold/50 hover:text-text"
            )}
          >
            Adicionar ao atual
          </button>
        </div>

        <Input
          label={mode === "set" ? "Novo estoque" : "Adicionar unidades"}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />

        {value !== "" && !Number.isNaN(amount) && (
          <p className="text-xs text-textDim">Estoque resultante: {resultingStock} unidades</p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={handleSubmit} loading={loading} className="w-full">
          <Save size={16} />
          Salvar
        </Button>
      </div>
    </Modal>
  );
}
