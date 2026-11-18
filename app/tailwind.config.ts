import type { Config } from 'tailwindcss';

/**
 * Tailwind theme mirrors `src/styles/tokens.ts`. Keep them in sync: any palette
 * change belongs in the token file, and this config re-exports it as utilities.
 */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                obsidian: {
                    DEFAULT: '#09090B',
                    50: '#FAFAFA',
                    400: '#A1A1AA',
                    500: '#71717A',
                },
                champagne: {
                    DEFAULT: '#E5C158',
                    100: '#F7EBC0',
                    200: '#EFDC97',
                    300: '#E5C158',
                    400: '#C9A63F',
                    500: '#A8882E',
                },
                violet: {
                    accent: '#A855F7',
                },
                fit: {
                    comfortable: '#34D399',
                    tight: '#FBBF24',
                    over: '#FB7185',
                },
            },
            fontFamily: {
                display: ['"Instrument Serif"', '"Cormorant Garamond"', 'Georgia', 'serif'],
                sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
            },
            backgroundImage: {
                meshChampagne:
                    'radial-gradient(ellipse 60% 50% at 15% 0%, rgba(212,175,55,0.08), transparent 70%)',
                meshViolet:
                    'radial-gradient(ellipse 55% 45% at 85% 8%, rgba(139,92,246,0.07), transparent 70%)',
            },
            boxShadow: {
                glass: '0 1px 0 rgba(255,255,255,0.06) inset',
                'glass-lg': '0 1px 0 rgba(255,255,255,0.08) inset, 0 24px 60px -24px rgba(0,0,0,0.8)',
                'glow-gold': '0 0 0 1px rgba(229,193,88,0.35), 0 0 32px -8px rgba(229,193,88,0.35)',
                'glow-violet': '0 0 0 1px rgba(168,85,247,0.35), 0 0 32px -8px rgba(168,85,247,0.45)',
            },
            borderRadius: {
                surface: '1rem',
                tile: '0.875rem',
            },
            transitionTimingFunction: {
                editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
            },
        },
    },
    plugins: [],
} satisfies Config;
