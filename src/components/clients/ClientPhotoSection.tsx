"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, Download, ImagePlus, Trash2, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import PhotoLightbox from "./PhotoLightbox";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatDate } from "@/lib/utils";
import {
  CLIENT_PHOTO_ACCEPTED_TYPES,
  CLIENT_PHOTO_BUCKET,
  CLIENT_PHOTO_MAX_SIZE_BYTES,
  buildClientPhotoPath,
} from "@/lib/clientPhotos";
import type { ClientPhotoType, ClienteFoto } from "@/lib/types/database";

interface ClientPhotoSectionProps {
  clientId: string;
  tipo: ClientPhotoType;
  title: string;
  description: string;
}

/**
 * Galeria de fotos do cliente (usada para "Ficha de Anamnese" e "Acompanhamento"). Tirar Foto
 * abre a câmera do celular direto (input capture="environment"); Enviar Arquivo abre a galeria.
 * Antes de subir, pede um nome. As miniaturas usam signed URLs — o bucket é privado.
 */
export default function ClientPhotoSection({ clientId, tipo, title, description }: ClientPhotoSectionProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile } = useAuth();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<ClienteFoto[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  async function loadPhotos() {
    setLoading(true);
    const { data } = await supabase
      .from("cliente_fotos")
      .select("*")
      .eq("cliente_id", clientId)
      .eq("tipo", tipo)
      .order("created_at", { ascending: false });
    const list = (data as ClienteFoto[]) ?? [];
    setPhotos(list);
    setLoading(false);

    if (list.length > 0) {
      const { data: signed } = await supabase.storage
        .from(CLIENT_PHOTO_BUCKET)
        .createSignedUrls(
          list.map((p) => p.storage_path),
          3600
        );
      const map: Record<string, string> = {};
      for (const s of signed ?? []) {
        if (s.signedUrl) map[s.path ?? ""] = s.signedUrl;
      }
      setThumbnails(map);
    } else {
      setThumbnails({});
    }
  }

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, tipo]);

  function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setShowAddMenu(false);
    if (!file) return;
    if (!CLIENT_PHOTO_ACCEPTED_TYPES.includes(file.type)) {
      showToast("Formato de imagem não suportado.", "error");
      return;
    }
    if (file.size > CLIENT_PHOTO_MAX_SIZE_BYTES) {
      showToast("A imagem deve ter até 8 MB.", "error");
      return;
    }
    setPendingFile(file);
    setPendingName(file.name.replace(/\.[^/.]+$/, ""));
  }

  function cancelPending() {
    setPendingFile(null);
    setPendingName("");
  }

  async function handleSaveUpload() {
    if (!pendingFile) return;
    if (!pendingName.trim()) {
      showToast("Dê um nome para a foto.", "error");
      return;
    }
    setUploading(true);
    const path = buildClientPhotoPath(clientId, tipo, pendingFile.name);

    const { error: uploadError } = await supabase.storage
      .from(CLIENT_PHOTO_BUCKET)
      .upload(path, pendingFile, { contentType: pendingFile.type });
    if (uploadError) {
      setUploading(false);
      showToast(uploadError.message, "error");
      return;
    }

    // O bucket é privado — esta "public URL" não abre sozinha; guardamos só como referência.
    // Toda exibição/baixa real usa signed URLs / download() autenticado (RLS: só staff).
    const {
      data: { publicUrl },
    } = supabase.storage.from(CLIENT_PHOTO_BUCKET).getPublicUrl(path);

    const { error: insertError } = await supabase.from("cliente_fotos").insert({
      cliente_id: clientId,
      tipo,
      nome: pendingName.trim(),
      url: publicUrl,
      storage_path: path,
      uploaded_by: profile?.id ?? null,
    });

    setUploading(false);
    if (insertError) {
      // Evita deixar um arquivo órfão no bucket se o registro não puder ser salvo.
      await supabase.storage.from(CLIENT_PHOTO_BUCKET).remove([path]);
      showToast(insertError.message, "error");
      return;
    }

    showToast("Foto salva");
    cancelPending();
    loadPhotos();
  }

  async function handleDownload(photo: ClienteFoto) {
    setBusyId(photo.id);
    const { data, error } = await supabase.storage.from(CLIENT_PHOTO_BUCKET).download(photo.storage_path);
    setBusyId(null);
    if (error || !data) {
      showToast(error?.message ?? "Não foi possível baixar a foto.", "error");
      return;
    }
    const ext = photo.storage_path.split(".").pop();
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = ext ? `${photo.nome}.${ext}` : photo.nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(photo: ClienteFoto) {
    if (!window.confirm(`Excluir a foto "${photo.nome}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(photo.id);
    await supabase.storage.from(CLIENT_PHOTO_BUCKET).remove([photo.storage_path]);
    const { error } = await supabase.from("cliente_fotos").delete().eq("id", photo.id);
    setBusyId(null);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Foto excluída");
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  function handleDeleteFromLightbox(photo: ClienteFoto) {
    // Fecha antes de excluir para nunca deixar o lightbox apontando pra um índice que já saiu do array.
    setLightboxIndex(null);
    handleDelete(photo);
  }

  return (
    <div className="flex flex-col gap-3 rounded-btn border border-border p-4">
      <div>
        <p className="text-sm font-medium text-text">{title}</p>
        <p className="text-xs text-textDim">{description}</p>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePickFile}
        className="hidden"
      />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePickFile} className="hidden" />

      {pendingFile ? (
        <div className="flex flex-col gap-2 rounded-btn bg-surface2 p-3">
          <p className="text-xs text-textDim">Nomeie a foto antes de salvar</p>
          <Input
            label="Nome do arquivo"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            placeholder="Ex: Anamnese assinada"
            autoFocus
            required
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cancelPending} className="flex-1">
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSaveUpload} loading={uploading} className="flex-1">
              Salvar
            </Button>
          </div>
        </div>
      ) : showAddMenu ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1"
          >
            <Camera size={14} />
            Tirar Foto
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            <Upload size={14} />
            Enviar Arquivo
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddMenu(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddMenu(true)} className="self-start">
          <ImagePlus size={14} />
          Adicionar Foto
        </Button>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
        </div>
      ) : photos.length === 0 ? (
        <p className="text-xs text-textDim">Nenhuma foto ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div key={photo.id} className="flex flex-col gap-1 rounded-btn border border-border p-1.5">
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label={`Ampliar foto ${photo.nome}`}
                className="aspect-square w-full overflow-hidden rounded-btn bg-surface2"
              >
                {thumbnails[photo.storage_path] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnails[photo.storage_path]}
                    alt={photo.nome}
                    className="h-full w-full object-cover transition duration-200 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-textDim">
                    <ImagePlus size={18} />
                  </div>
                )}
              </button>
              <p className="truncate text-[11px] font-medium text-text" title={photo.nome}>
                {photo.nome}
              </p>
              <p className="text-[10px] text-textDim">{formatDate(new Date(photo.created_at))}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleDownload(photo)}
                  disabled={busyId === photo.id}
                  aria-label="Baixar"
                  className="flex flex-1 items-center justify-center rounded-btn border border-border py-1 text-textDim transition duration-200 hover:border-gold hover:text-gold disabled:opacity-50"
                >
                  <Download size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(photo)}
                  disabled={busyId === photo.id}
                  aria-label="Excluir"
                  className="flex flex-1 items-center justify-center rounded-btn border border-border py-1 text-textDim transition duration-200 hover:border-danger hover:text-danger disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          imageUrls={thumbnails}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onDownload={handleDownload}
          onDelete={handleDeleteFromLightbox}
          busyId={busyId}
        />
      )}
    </div>
  );
}
