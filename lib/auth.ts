import { NextRequest } from 'next/server';

export function isAdminAuthorized(req: NextRequest): boolean {
  const passcode = req.headers.get('x-admin-passcode');
  const expected = process.env.ADMIN_PASSCODE;
  return !!passcode && !!expected && passcode === expected;
}
