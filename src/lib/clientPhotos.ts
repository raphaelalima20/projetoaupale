export const CLIENT_PHOTO_BUCKET = "cliente-fotos";
export const CLIENT_PHOTO_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];
export const CLIENT_PHOTO_MAX_SIZE_BYTES = 8 * 1024 * 1024;

/** `${clienteId}/{tipo}/{timestamp}_{arquivo saneado}` — organiza o bucket como pedido. */
export function buildClientPhotoPath(
  clientId: string,
  tipo: "anamnese" | "acompanhamento",
  fileName: string
): string {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${clientId}/${tipo}/${Date.now()}.${ext}`;
}
