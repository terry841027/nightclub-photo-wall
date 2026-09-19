import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ requireApproval: true });
  }

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'require_approval')
    .maybeSingle();

  return NextResponse.json({ requireApproval: data ? data.value === 'true' : true });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.requireApproval !== 'boolean') {
    return NextResponse.json({ error: '無效的請求' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: '伺服器尚未設定完成' }, { status: 500 });
  }

  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'require_approval', value: String(body.requireApproval) });

  if (error) {
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
