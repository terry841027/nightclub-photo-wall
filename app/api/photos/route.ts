import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') === 'pending' ? 'pending' : 'approved';

  if (status === 'pending' && !isAdminAuthorized(req)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: '伺服器尚未設定完成' }, { status: 500 });
  }

  const query = supabase
    .from('photos')
    .select('id, image_url, caption, status, source, created_at, sort_order')
    .eq('status', status)
    .limit(100);

  const { data, error } =
    status === 'approved'
      ? await query.order('sort_order', { ascending: true })
      : await query.order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: '讀取失敗' }, { status: 500 });
  }

  return NextResponse.json({ photos: data });
}
