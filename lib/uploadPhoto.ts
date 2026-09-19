import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTOS_BUCKET } from './supabaseAdmin';

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_CAPTION_LENGTH = 140;

export type PhotoStatus = 'pending' | 'approved';
export type PhotoSource = 'guest' | 'staff';

export async function uploadPhotoFile(
  supabase: SupabaseClient,
  file: File,
  captionRaw: string,
  status: PhotoStatus,
  source: PhotoSource
) {
  const caption = captionRaw.slice(0, MAX_CAPTION_LENGTH).trim();

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: '只接受 JPEG / PNG / WebP 圖片' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: '照片太大,請小於 8MB' };
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: `上傳失敗:${uploadError.message}` };
  }

  const { data: publicUrlData } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);

  const { data: photo, error: insertError } = await supabase
    .from('photos')
    .insert({
      image_path: path,
      image_url: publicUrlData.publicUrl,
      caption,
      status,
      source,
    })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    return { error: `儲存失敗:${insertError.message}` };
  }

  return { photo };
}
