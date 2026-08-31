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
  !env.forceDemo && env.supabaseUrl && env.supabaseAnonKey
);

let client: SupabaseClientLike | null = null;
let waitPromise: Promise<SupabaseClientLike | null> | null = null;

export function refreshSupabase(): SupabaseClientLike | null {
  if (client || !isSupabaseConfigured || !window.supabase) return client;
  client = window.supabase.createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return client;
}

export function getSupabase(): SupabaseClientLike | null {
  return refreshSupabase();
}

export function waitForSupabase(timeoutMs = 2500): Promise<SupabaseClientLike | null> {
  const ready = refreshSupabase();
  if (ready || !isSupabaseConfigured) return Promise.resolve(ready);
  if (waitPromise) return waitPromise;

  waitPromise = new Promise(resolve => {
    const started = performance.now();
    const timer = window.setInterval(() => {
      const current = refreshSupabase();
      if (current || performance.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        const result = current;
        waitPromise = null;
        resolve(result);
      }
    }, 50);
  });

  return waitPromise;
}

export const supabase: SupabaseClientLike | null = refreshSupabase();
