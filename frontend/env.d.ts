/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_PB_URL?: string
  readonly VITE_PB_EMAIL?: string
  readonly VITE_PB_PASSWORD?: string
  readonly VITE_DEFAULT_AI_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __GEO_CONFIG__?: { pbUrl: string }
  __GEO_ENV__?: { VITE_DEFAULT_AI_KEY: string }
}
