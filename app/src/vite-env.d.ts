/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly MODE: string;
    /** Set by Vitest; used to collapse all animation for deterministic tests. */
    readonly VITEST?: boolean;

    /** LumiaRouter OpenAI-compatible base URL. */
    readonly VITE_AI_BASE_URL?: string;
    /**
     * Optional. Compiled into the browser bundle, so it is readable by anyone who
     * opens devtools. Prefer the server-side `LUMIA_API_KEY` + dev proxy. Empty is
     * a supported state: the app falls back to the local deterministic engine.
     */
    readonly VITE_AI_API_KEY?: string;
    /** Model identifier, e.g. claude-opus-5-5. */
    readonly VITE_AI_MODEL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
