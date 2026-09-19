import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminAuthorized } from '@/lib/auth';
import { uploadPhotoFile } from '@/lib/uploadPhoto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: '伺服器尚未設定完成' }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('photo');
  const captionRaw = form?.get('caption');
  const caption = typeof captionRaw === 'string' ? captionRaw : '';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少照片檔案' }, { status: 400 });
  }

  const result = await uploadPhotoFile(supabase, file, caption, 'approved', 'staff');

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ photo: result.photo });
}
