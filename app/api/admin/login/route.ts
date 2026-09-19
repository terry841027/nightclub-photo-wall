import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const passcode = body?.passcode;
  const expected = process.env.ADMIN_PASSCODE;

  if (typeof passcode !== 'string' || passcode.length === 0 || !expected) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ok = passcode === expected;
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
