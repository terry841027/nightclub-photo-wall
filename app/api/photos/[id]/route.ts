import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabaseAdmin';
import { isAdminAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || body.status !== 'approved') {
    return NextResponse.json({ error: '無效的請求' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: '伺服器尚未設定完成' }, { status: 500 });
  }

  const { id } = await params;
  const { error } = await supabase.from('photos').update({ status: 'approved' }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: '伺服器尚未設定完成' }, { status: 500 });
  }

  const { id } = await params;
  const { data: photo } = await supabase
    .from('photos')
    .select('image_path')
    .eq('id', id)
    .maybeSingle();

  await supabase.from('photos').delete().eq('id', id);

  if (photo?.image_path) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([photo.image_path]);
  }

  return NextResponse.json({ ok: true });
}
