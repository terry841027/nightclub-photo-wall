import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_SLIDE_DURATION_MS = 6000;
const ALLOWED_SLIDE_DURATIONS_MS = [5000, 10000];

const DEFAULT_CAPTION_FONT_SIZE_PX = 36;
const MIN_CAPTION_FONT_SIZE_PX = 16;
const MAX_CAPTION_FONT_SIZE_PX = 96;

const DEFAULT_CAPTION_POSITION_PERCENT = 6;
const MIN_CAPTION_POSITION_PERCENT = 0;
const MAX_CAPTION_POSITION_PERCENT = 85;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const DEFAULTS = {
  requireApproval: true,
  slideDurationMs: DEFAULT_SLIDE_DURATION_MS,
  captionFontSizePx: DEFAULT_CAPTION_FONT_SIZE_PX,
  captionPositionPercent: DEFAULT_CAPTION_POSITION_PERCENT,
};

export async function GET() {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json(DEFAULTS);
  }

  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'require_approval',
      'slide_duration_ms',
      'caption_font_size_px',
      'caption_position_percent',
    ]);

  const row = (key: string) => data?.find((r) => r.key === key)?.value;

  return NextResponse.json({
    requireApproval: row('require_approval') !== 'false',
    slideDurationMs: Number(row('slide_duration_ms')) || DEFAULT_SLIDE_DURATION_MS,
    captionFontSizePx: Number(row('caption_font_size_px')) || DEFAULT_CAPTION_FONT_SIZE_PX,
    captionPositionPercent:
      row('caption_position_percent') !== undefined
        ? Number(row('caption_position_percent'))
        : DEFAULT_CAPTION_POSITION_PERCENT,
  });
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

  if (typeof body.captionFontSizePx === 'number') {
    const px = clamp(body.captionFontSizePx, MIN_CAPTION_FONT_SIZE_PX, MAX_CAPTION_FONT_SIZE_PX);
    updates.push({ key: 'caption_font_size_px', value: String(px) });
  }

  if (typeof body.captionPositionPercent === 'number') {
    const pct = clamp(
      body.captionPositionPercent,
      MIN_CAPTION_POSITION_PERCENT,
      MAX_CAPTION_POSITION_PERCENT
    );
    updates.push({ key: 'caption_position_percent', value: String(pct) });
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
