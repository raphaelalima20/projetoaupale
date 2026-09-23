"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ImageUpload from "./ImageUpload";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { uploadProductImage } from "@/lib/products";
import type { Product } from "@/lib/types/database";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: Product | null;
}

export default function ProductFormModal({ open, onClose, onSaved, product }: ProductFormModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [minStockAlert, setMinStockAlert] = useState("5");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!open) return;
    setConfirmingDelete(false);
    setDeleting(false);
    setDeleteError("");
    if (product) {
      setName(product.name);
      setBrand(product.brand ?? "");
      setDescription(product.description ?? "");
      setPrice(String(product.price));
      setPromoPrice(product.promotional_price !== null ? String(product.promotional_price) : "");
      setStockQuantity(String(product.stock_quantity));
      setMinStockAlert(String(product.min_stock_alert ?? 5));
      setPreviewUrl(product.image_url);
    } else {
      setName("");
      setBrand("");
      setDescription("");
      setPrice("");
      setPromoPrice("");
      setStockQuantity("0");
      setMinStockAlert("5");
      setPreviewUrl(null);
    }
    setImageFile(null);
    setError("");
  }, [open, product]);

  function handleSelectImage(file: File) {
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    setImageFile(null);
    setPreviewUrl(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Informe o nome do produto.");
    const priceNumber = Number(price);
    if (!price || Number.isNaN(priceNumber) || priceNumber <= 0) {
      return setError("Informe um preço válido.");
    }
    const promoNumber = promoPrice ? Number(promoPrice) : null;
    if (promoPrice && (Number.isNaN(promoNumber) || (promoNumber as number) <= 0)) {
      return setError("Informe um preço promocional válido.");
    }
    if (promoNumber !== null && promoNumber >= priceNumber) {
      return setError("O preço promocional deve ser menor que o preço original.");
    }
    const stockNumber = Number(stockQuantity);
    if (stockQuantity === "" || Number.isNaN(stockNumber) || stockNumber < 0) {
      return setError("Informe uma quantidade em estoque válida.");
    }

    setLoading(true);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      brand: brand.trim() || null,
      description: description.trim() || null,
      price: priceNumber,
      promotional_price: promoNumber,
      stock_quantity: stockNumber,
      min_stock_alert: Number(minStockAlert) || 5,
    };

    if (!imageFile && previewUrl === null) {
      payload.image_url = null;
    }

    let saveError;
    let savedId = product?.id ?? null;

    if (product) {
      ({ error: saveError } = await supabase.from("products").update(payload).eq("id", product.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("products")
        .insert({ ...payload, is_active: true })
        .select()
        .single();
      saveError = insertError;
      savedId = data?.id ?? null;
    }

    if (saveError) {
      setError(saveError.message);
      setLoading(false);
      return;
    }

    if (imageFile && savedId) {
      try {
        const url = await uploadProductImage(supabase, imageFile, savedId);
        await supabase.from("products").update({ image_url: url }).eq("id", savedId);
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : "Falha ao enviar a foto.");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    showToast(product ? "Produto atualizado" : "Produto criado");
    onSaved();
    onClose();
  }

  async function handleToggleActive() {
    if (!product) return;
    setLoading(true);
    const { error: toggleError } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    setLoading(false);
    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    showToast(product.is_active ? "Produto desativado" : "Produto reativado");
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!product) return;
    setDeleting(true);
    setDeleteError("");

    const { count } = await supabase
      .from("product_sales")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id);

    if ((count ?? 0) > 0) {
      setDeleting(false);
      setDeleteError(
        'Este produto já tem vendas/movimentações de estoque registradas. Use "Desativar" em vez de excluir.'
      );
      return;
    }

    const { error: deleteErr } = await supabase.from("products").delete().eq("id", product.id);
    setDeleting(false);
    if (deleteErr) {
      setDeleteError(deleteErr.message);
      return;
    }
    showToast("Produto excluído");
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? "Editar Produto" : "Novo Produto"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ImageUpload previewUrl={previewUrl} onSelect={handleSelectImage} onRemove={handleRemoveImage} />

        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input label="Marca" value={brand} onChange={(e) => setBrand(e.target.value)} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-description" className="text-sm text-textDim">
            Descrição
          </label>
          <textarea
            id="product-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-btn border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
            placeholder="Opcional"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Preço original (R$)"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <Input
            label="Preço promocional (R$)"
            type="number"
            step="0.01"
            min="0"
            value={promoPrice}
            onChange={(e) => setPromoPrice(e.target.value)}
            placeholder="Deixe vazio se não houver"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantidade em estoque"
            type="number"
            min="0"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            required
          />
          <Input
            label="Alerta de estoque mínimo"
            type="number"
            min="0"
            value={minStockAlert}
            onChange={(e) => setMinStockAlert(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} className="mt-2 w-full">
          <Save size={16} />
          {product ? "Salvar Alterações" : "Salvar Produto"}
        </Button>

        {product && (
          <Button
            type="button"
            variant={product.is_active ? "danger" : "secondary"}
            onClick={handleToggleActive}
            disabled={loading}
            className="w-full"
          >
            {product.is_active ? "Desativar Produto" : "Reativar"}
          </Button>
        )}

        {product && (
          <div className="border-t border-border pt-4">
            {confirmingDelete ? (
              <div className="flex flex-col gap-3 rounded-btn border border-danger/30 bg-danger/10 p-3">
                <p className="text-sm text-danger">
                  Tem certeza que deseja excluir? Esta ação não pode ser desfeita.
                </p>
                {deleteError && <p className="text-xs text-danger">{deleteError}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDelete}
                    loading={deleting}
                    className="flex-1"
                  >
                    Confirmar exclusão
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setDeleteError("");
                  setConfirmingDelete(true);
                }}
                disabled={loading}
                className="w-full"
              >
                <Trash2 size={16} />
                Excluir Produto
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
