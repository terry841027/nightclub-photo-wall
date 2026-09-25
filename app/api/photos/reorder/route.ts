import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const firstId = body?.firstId;
  const secondId = body?.secondId;
  if (typeof firstId !== 'string' || typeof secondId !== 'string') {
    return NextResponse.json({ error: '無效的請求' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: '伺服器尚未設定完成' }, { status: 500 });
  }

  const { data: rows, error: fetchError } = await supabase
    .from('photos')
    .select('id, sort_order')
    .in('id', [firstId, secondId]);

  if (fetchError || !rows || rows.length !== 2) {
    return NextResponse.json({ error: '找不到照片' }, { status: 404 });
  }

  const first = rows.find((r) => r.id === firstId);
  const second = rows.find((r) => r.id === secondId);
  if (!first || !second) {
    return NextResponse.json({ error: '找不到照片' }, { status: 404 });
  }

  const [{ error: error1 }, { error: error2 }] = await Promise.all([
    supabase.from('photos').update({ sort_order: second.sort_order }).eq('id', first.id),
    supabase.from('photos').update({ sort_order: first.sort_order }).eq('id', second.id),
  ]);

  if (error1 || error2) {
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
