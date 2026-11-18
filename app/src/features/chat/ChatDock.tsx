import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import type { ChatTurn, UserPreferences } from '@/types/domain';
import { useMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { parseChatMessage } from './parseIntent';

interface ChatDockProps {
    preferences: UserPreferences;
    onApplyPatch: (patch: Partial<UserPreferences>) => void;
    chatLog: ChatTurn[];
    onPushTurn: (turn: ChatTurn) => void;
}

const SUGGESTIONS = [
    'Summer wedding under $250',
    'Business formal for work',
    'Make it cheaper',
    'Minimalist, black, under $180',
];

/**
 * Command-palette style styling assistant.
 *
 * Fixed glass dock at the bottom with a gradient glow that activates only on
 * focus, so it reads as a tool you summon rather than persistent chrome. Three
 * suggestion chips (plus a fourth) let a sceptical reviewer try it in one click.
 *
 * Interaction contract: every message produces a transcript line stating exactly
 * which preference fields changed. Auto-updating four saved fields with no
 * visible receipt would be indistinguishable from doing nothing.
 */
export function ChatDock({
    preferences,
    onApplyPatch,
    chatLog,
    onPushTurn,
}: ChatDockProps) {
    const { reduced, patch } = useMotion();
    const [value, setValue] = useState('');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatLog.length]);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setValue('');
                inputRef.current?.blur();
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    function submit(message: string) {
        const text = message.trim();
        if (!text) return;

        onPushTurn({
            id: `u-${Date.now()}`,
            role: 'user',
            text,
            timestamp: Date.now(),
        });

        const intent = parseChatMessage(text, preferences);

        if (Object.keys(intent.patch).length > 0) {
            onApplyPatch(intent.patch);
        }

        onPushTurn({
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: intent.reply,
            appliedFields: intent.appliedFields,
            timestamp: Date.now(),
        });

        setValue('');
    }

    const recent = chatLog.slice(-3);

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5">
            <div className="pointer-events-auto w-full max-w-2xl">
                {/* Transcript */}
                {recent.length > 0 && (
                    <div
                        ref={scrollRef}
                        className="mb-2 max-h-40 space-y-1.5 overflow-y-auto scrollbar-none"
                        aria-live="polite"
                        aria-label="Assistant conversation"
                    >
                        {recent.map((turn) => (
                            <div
                                key={turn.id}
                                className={cn(
                                    'rounded-tile border px-3.5 py-2 backdrop-blur-xl',
                                    turn.role === 'assistant'
                                        ? 'border-white/10 bg-white/[0.04]'
                                        : 'border-champagne/25 bg-champagne/[0.06]',
                                )}
                            >
                                <p className="text-[0.8125rem] leading-relaxed text-obsidian-50">
                                    {turn.text}
                                </p>
                                {turn.appliedFields && turn.appliedFields.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {turn.appliedFields.map((field, index) => (
                                            <motion.span
                                                key={field}
                                                variants={patch}
                                                initial="hidden"
                                                animate="show"
                                                transition={{ delay: reduced ? 0 : index * 0.05 }}
                                                className="inline-flex items-center gap-1 rounded-pill border border-champagne/30 bg-champagne/10 px-2 py-0.5 font-data text-[0.625rem] text-champagne-200"
                                            >
                                                <span className="h-1 w-1 rounded-full bg-champagne" aria-hidden="true" />
                                                {field}
                                            </motion.span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Suggestion chips */}
                <div className="mb-2 flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                        <button
                            key={suggestion}
                            type="button"
                            onClick={() => submit(suggestion)}
                            className="rounded-pill border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.6875rem] text-obsidian-400 backdrop-blur-xl transition-colors hover:border-champagne/40 hover:text-white"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>

                {/* Input */}
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit(value);
                    }}
                    className="relative"
                >
                    {/* Animated gradient border, focus only. */}
                    <div
                        className={cn(
                            'absolute -inset-px rounded-surface opacity-0 transition-opacity duration-300',
                            focused && 'opacity-100',
                        )}
                        style={{
                            background:
                                'linear-gradient(120deg, rgba(229,193,88,0.5), rgba(168,85,247,0.5), rgba(229,193,88,0.5))',
                        }}
                        aria-hidden="true"
                    />

                    <div className="relative flex items-center gap-2 rounded-surface border border-white/10 bg-obsidian/90 px-3 py-2.5 backdrop-blur-xl">
                        <Sparkles className="h-4 w-4 shrink-0 text-violet" aria-hidden="true" />

                        <label htmlFor="chat-input" className="sr-only">
                            Ask the styling assistant
                        </label>
                        <input
                            id="chat-input"
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            placeholder="What should I wear to a summer wedding under $250?"
                            autoComplete="off"
                            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-obsidian-500"
                        />

                        {value && (
                            <button
                                type="button"
                                onClick={() => setValue('')}
                                aria-label="Clear input"
                                className="shrink-0 rounded-full p-1 text-obsidian-500 transition-colors hover:text-white"
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={!value.trim()}
                            aria-label="Send message"
                            className="shrink-0 rounded-full bg-champagne p-1.5 text-obsidian transition-colors hover:bg-champagne-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-obsidian-500"
                        >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                    </div>
                </form>

                <p className="mt-1.5 text-center text-[0.625rem] text-obsidian-500">
                    On-device parser — no message leaves your browser.
                </p>
            </div>
        </div>
    );
}
