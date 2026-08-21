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

function normalizeRedirectUri(value: string): string {
  const raw = value.trim();
  if (!raw) return 'https://chiangraiminiapp.vercel.app/';

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return 'https://chiangraiminiapp.vercel.app/';
    }
    return url.toString();
  } catch {
    return 'https://chiangraiminiapp.vercel.app/';
  }
}

export const env = {
  liffId: normalizeLiffId(import.meta.env.VITE_LIFF_ID || ''),
  liffRedirectUri: normalizeRedirectUri(
    import.meta.env.VITE_LIFF_REDIRECT_URI || 'https://chiangraiminiapp.vercel.app/'
  ),
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
