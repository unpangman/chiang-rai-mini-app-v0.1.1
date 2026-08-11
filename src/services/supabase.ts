import { env } from '../config';

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

export const isSupabaseConfigured = Boolean(
  !env.forceDemo && env.supabaseUrl && env.supabaseAnonKey && window.supabase
);

export const supabase: SupabaseClientLike | null = isSupabaseConfigured && window.supabase
  ? window.supabase.createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;
