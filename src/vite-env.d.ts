interface ImportMetaEnv {
  readonly VITE_LIFF_ID?: string;
  readonly VITE_LIFF_REDIRECT_URI?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_ADMIN_PASSWORD_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare interface Window {
  L?: typeof import('leaflet');
}

declare module '*.css' {
  const content: string;
  export default content;
}
