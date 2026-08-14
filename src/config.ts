function normalizeLiffId(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (url.hostname === 'miniapp.line.me') {
      return url.pathname.split('/').filter(Boolean).at(-1) || '';
    }
  } catch {
    // A normal LIFF ID is not a URL and should be used unchanged.
  }

  return raw;
}

export const env = {
  liffId: normalizeLiffId(import.meta.env.VITE_LIFF_ID || ''),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '',
  forceDemo: String(import.meta.env.VITE_DEMO_MODE).toLowerCase() === 'true',
  adminPasswordHash: (import.meta.env.VITE_ADMIN_PASSWORD_HASH || '').trim().toLowerCase()
};

export const appConfig = {
  cityName: 'เทศบาลนครเชียงราย',
  mapCenter: { lat: 19.9072, lng: 99.8326 },
  mapZoom: 14
};
