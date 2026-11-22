import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronDown, Loader2, Sparkles, Wifi, WifiOff, X } from 'lucide-react';
import type { AiStatus } from '@/services/aiStylist';
import type { ChatTurn, UserPreferences } from '@/types/domain';
import { useMotion } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { parseChatMessage } from './parseIntent';

interface ChatDockProps {
    initiallyOpen?: boolean;
    preferences: UserPreferences;
    onApplyPatch: (patch: Partial<UserPreferences>) => void;
    chatLog: ChatTurn[];
    onPushTurn: (turn: ChatTurn) => void;
    /**
     * Live model parser. Returns null when the model is unavailable or its output
     * failed validation, which is the signal to use the local parser instead.
     */
    onParseWithAi: (
        message: string,
        current: UserPreferences,
    ) => Promise<{
        patch: Partial<UserPreferences>;
        reply: string;
        appliedFields: string[];
        understood: boolean;
    } | null>;
    aiStatus: AiStatus;
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
 * Dual-path by design. The live model is tried first when configured; if it is
 * unconfigured, offline, rate-limited, slow, or returns something that fails
 * validation, the deterministic local parser answers instead. The user sees one
 * continuous assistant either way — the badge is the only tell, and it reports
 * which engine actually replied rather than which one was configured.
 *
 * That distinction matters: a badge claiming "Live" while the local parser did
 * the work would be a lie in the one place the user is being asked to trust the
 * system.
 */
export function ChatDock({
    initiallyOpen = true,
    preferences,
    onApplyPatch,
    chatLog,
    onPushTurn,
    onParseWithAi,
    aiStatus,
}: ChatDockProps) {
    const { reduced, patch } = useMotion();
    const [open, setOpen] = useState(initiallyOpen);
    const [value, setValue] = useState('');
    const [focused, setFocused] = useState(false);
    const [pending, setPending] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatLog.length, open]);

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

    async function submit(message: string) {
        const text = message.trim();
        if (!text || pending) return;

        onPushTurn({
            id: `u-${Date.now()}`,
            role: 'user',
            text,
            timestamp: Date.now(),
        });

        setPending(true);

        let reply: string;
        let appliedFields: string[] = [];

        try {
            const aiResult = await onParseWithAi(text, preferences);

            if (aiResult) {
                // Live path succeeded and already passed validation.
                if (Object.keys(aiResult.patch).length > 0) {
                    onApplyPatch(aiResult.patch);
                }
                reply = aiResult.reply;
                appliedFields = aiResult.appliedFields;
            } else {
                // Local path. Same behaviour as Sprint 1, unchanged.
                const intent = parseChatMessage(text, preferences);
                if (Object.keys(intent.patch).length > 0) {
                    onApplyPatch(intent.patch);
                }
                reply = intent.reply;
                appliedFields = intent.appliedFields;
            }
        } catch {
            // A thrown error must never leave the user without an answer.
            const intent = parseChatMessage(text, preferences);
            if (Object.keys(intent.patch).length > 0) {
                onApplyPatch(intent.patch);
            }
            reply = intent.reply;
            appliedFields = intent.appliedFields;
        } finally {
            setPending(false);
        }

        onPushTurn({
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: reply,
            appliedFields,
            timestamp: Date.now(),
        });

        setValue('');
    }

    const recent = chatLog.slice(-3);
    const isLive = aiStatus === 'live';

    return (
        <details
            open={open}
            onToggle={(event) => setOpen(event.currentTarget.open)}
            className="mt-8 rounded-surface border border-white/10 bg-obsidian/90 [&[open]_.chat-chevron]:rotate-180"
        >
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-surface px-4 py-3 text-sm font-medium text-champagne focus-visible:outline focus-visible:outline-champagne [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" aria-hidden="true" /> Style assistant</span>
                <ChevronDown className="chat-chevron h-4 w-4" aria-hidden="true" />
            </summary>
            <div className="mx-auto w-full max-w-2xl px-4 pb-4">
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
                                <p className="text-[0.8125rem] leading-relaxed text-obsidian-50">{turn.text}</p>
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
                            disabled={pending}
                            onClick={() => void submit(suggestion)}
                            className="rounded-pill border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.6875rem] text-obsidian-400 backdrop-blur-xl transition-colors hover:border-champagne/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>

                {/* Input */}
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void submit(value);
                    }}
                    className="relative"
                >
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

                        {value && !pending && (
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
                            disabled={!value.trim() || pending}
                            aria-label="Send message"
                            className="shrink-0 rounded-full bg-champagne p-1.5 text-obsidian transition-colors hover:bg-champagne-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-obsidian-500"
                        >
                            {pending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-1.5 flex items-center justify-center gap-2">
                    <EngineBadge status={aiStatus} />
                    <span className="text-[0.625rem] text-obsidian-500">
                        {isLive
                            ? 'Responses from the live model, validated against the catalog before applying.'
                            : 'Runs on-device — no message leaves your browser.'}
                    </span>
                </div>
            </div>
        </details>
    );
}

/**
 * Engine status badge.
 *
 * Deliberately quiet: a small dot, a label, and a tooltip. It answers "did the
 * model actually answer me?" for a reviewer, without becoming a feature the user
 * has to think about. `role="status"` means a screen reader announces a change
 * from Live to Local if the network fails mid-session.
 */
export function EngineBadge({ status }: { status: AiStatus }) {
    const isLive = status === 'live';
    const Icon = isLive ? Wifi : WifiOff;

    return (
        <span
            role="status"
            title={
                isLive
                    ? 'Replies come from the live LumiaRouter model. Every preference is validated before it is applied.'
                    : 'Using the deterministic on-device engine. No network calls, no API key required.'
            }
            className={cn(
                'inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 font-data text-[0.5625rem] uppercase tracking-[0.1em]',
                isLive
                    ? 'border-violet/40 bg-violet/10 text-violet'
                    : 'border-white/10 bg-white/[0.03] text-obsidian-500',
            )}
        >
            <Icon className="h-2.5 w-2.5" aria-hidden="true" />
            {isLive ? 'Opus 5.5 Live' : 'Local Engine'}
        </span>
    );
}
