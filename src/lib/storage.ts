import type { SupabaseClient } from "@supabase/supabase-js";

/** Uploads a file to a public Storage bucket and returns its public URL. */
export async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  file: File,
  keyPrefix: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${keyPrefix}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}
