import { env } from '../config';
import { loadScript } from './assetLoader';

const SUPABASE_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

export type SupabaseClientLike = {
  from(table: string): any;
  rpc(functionName: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  storage: {
    from(bucket: string): {
      upload(path: string, file: File, options?: Record<string, unknown>): Promise<{ error: unknown }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
};

declare global {
  interface Window {
    supabase?: {
      createClient(url: string, key: string, options?: Record<string, unknown>): SupabaseClientLike;
    };
  }
}

export const isSupabaseConfigured = Boolean(!env.forceDemo && env.supabaseUrl && env.supabaseAnonKey);

let client: SupabaseClientLike | null = null;
let initialization: Promise<SupabaseClientLike | null> | null = null;

async function initializeSupabase(): Promise<SupabaseClientLike | null> {
  if (!isSupabaseConfigured) return null;
  await loadScript(SUPABASE_SDK, () => Boolean(window.supabase));
  client = window.supabase
    ? window.supabase.createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
    : null;
  return client;
}

export function getSupabase(): Promise<SupabaseClientLike | null> {
  if (client) return Promise.resolve(client);
  initialization ??= initializeSupabase();
  return initialization;
}
