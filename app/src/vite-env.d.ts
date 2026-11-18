/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly MODE: string;
    /** Set by Vitest; used to collapse all animation for deterministic tests. */
    readonly VITEST?: boolean;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
