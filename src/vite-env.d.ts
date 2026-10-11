/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "on" enables the AI step-by-step explainer (see src/ui/explain/flag.ts). */
  readonly VITE_AI_EXPLAINER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
