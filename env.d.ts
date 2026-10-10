/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />
/// <reference types="unplugin-fonts/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}