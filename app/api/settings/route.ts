import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_SLIDE_DURATION_MS = 6000;
const ALLOWED_SLIDE_DURATIONS_MS = [5000, 10000];

export async function GET() {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ requireApproval: true, slideDurationMs: DEFAULT_SLIDE_DURATION_MS });
  }

  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['require_approval', 'slide_duration_ms']);

  const row = (key: string) => data?.find((r) => r.key === key)?.value;

  const requireApproval = row('require_approval') !== 'false';
  const slideDurationMs = Number(row('slide_duration_ms')) || DEFAULT_SLIDE_DURATION_MS;

  return NextResponse.json({ requireApproval, slideDurationMs });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: '無效的請求' }, { status: 400 });
  }

  const updates: { key: string; value: string }[] = [];

  if (typeof body.requireApproval === 'boolean') {
    updates.push({ key: 'require_approval', value: String(body.requireApproval) });
  }

  if (
    typeof body.slideDurationMs === 'number' &&
    ALLOWED_SLIDE_DURATIONS_MS.includes(body.slideDurationMs)
  ) {
    updates.push({ key: 'slide_duration_ms', value: String(body.slideDurationMs) });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: '無效的請求' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: '伺服器尚未設定完成' }, { status: 500 });
  }

  const { error } = await supabase.from('settings').upsert(updates);

  if (error) {
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
