/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_HW_CLASSIC_UI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
