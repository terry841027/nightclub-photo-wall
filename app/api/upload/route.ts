import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_CAPTION_LENGTH = 140;

export async function POST(req: NextRequest) {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: '伺服器尚未設定完成' }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('photo');
  const captionRaw = form?.get('caption');
  const caption = typeof captionRaw === 'string' ? captionRaw.slice(0, MAX_CAPTION_LENGTH).trim() : '';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少照片檔案' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '只接受 JPEG / PNG / WebP 圖片' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: '照片太大,請小於 8MB' }, { status: 400 });
  }

  const { data: settingRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'require_approval')
    .maybeSingle();
  const requireApproval = settingRow ? settingRow.value === 'true' : true;

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `上傳失敗:${uploadError.message}` }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);

  const { data: photo, error: insertError } = await supabase
    .from('photos')
    .insert({
      image_path: path,
      image_url: publicUrlData.publicUrl,
      caption,
      status: requireApproval ? 'pending' : 'approved',
    })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    return NextResponse.json({ error: `儲存失敗:${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ photo, requireApproval });
}
