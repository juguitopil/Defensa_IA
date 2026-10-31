/// <reference types="vite/client" />

declare module "*.css?inline" {
  const css: string;
  export default css;
}

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
