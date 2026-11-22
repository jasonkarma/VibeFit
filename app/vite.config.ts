import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev-only availability probe for the AI badge.
 *
 * Answers "is a key configured?" without ever returning the key itself, so the
 * chat badge can say "Opus 5.5 Live" honestly instead of guessing from a value
 * compiled into the client bundle.
 *
 * Registered before the proxy so `/api/lumia/health` is answered locally rather
 * than being forwarded upstream as a 404.
 */
function lumiaHealthPlugin(hasServerKey: boolean): Plugin {
    return {
        name: 'vibefit-lumia-health',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/api/lumia/health', (req, res) => {
                // Only report capability, never the credential or its length.
                const clientKeyConfigured = Boolean(process.env.VITE_AI_API_KEY);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store');
                res.end(
                    JSON.stringify({
                        configured: hasServerKey || clientKeyConfigured,
                        keyLocation: hasServerKey ? 'server' : clientKeyConfigured ? 'client' : 'none',
                        model: process.env.VITE_AI_MODEL || 'claude-opus-5-5',
                    }),
                );
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    // Prefix '' loads non-prefixed vars too, so the server-side key is visible here
    // while never entering the client bundle.
    const env = loadEnv(mode, process.cwd(), '');
    const upstream = env.VITE_AI_BASE_URL || 'https://lumiarouter.com/v1';
    const serverKey = env.LUMIA_API_KEY || '';

    return {
        plugins: [react(), lumiaHealthPlugin(Boolean(serverKey))],
        optimizeDeps: { include: ['@mediapipe/tasks-vision', 'three'] },

        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },

        server: {
            port: 5173,
            open: false,
            proxy: {
                /**
                 * Localhost CORS workaround. The browser talks to same-origin
                 * `/api/lumia/*`; Vite forwards to LumiaRouter.
                 *
                 * If `LUMIA_API_KEY` is set, the Authorization header is injected here
                 * and stripped from the outgoing client request. That keeps the key out
                 * of the bundle entirely — the safer of the two supported modes.
                 */
                '/api/lumia': {
                    target: upstream,
                    changeOrigin: true,
                    secure: true,
                    rewrite: (path) => path.replace(/^\/api\/lumia/, ''),
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq, req) => {
                            if (!serverKey) return;
                            // Server-side key wins over any browser-supplied one.
                            proxyReq.setHeader('Authorization', `Bearer ${serverKey}`);
                            void req;
                        });
                    },
                },
            },
        },
    };
});
