import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

// Lazily created so that missing env vars only fail real requests,
// never the Next.js build step (which imports every route module).
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export const PHOTOS_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'photos';
