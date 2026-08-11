export const env = {
  liffId: import.meta.env.VITE_LIFF_ID?.trim() || '',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '',
  forceDemo: String(import.meta.env.VITE_DEMO_MODE).toLowerCase() === 'true'
};

export const appConfig = {
  cityName: 'เทศบาลนครเชียงราย',
  mapCenter: { lat: 19.9072, lng: 99.8326 },
  mapZoom: 14
};
