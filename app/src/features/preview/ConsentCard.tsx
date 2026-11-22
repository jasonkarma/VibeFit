import { Camera, Lock, ShieldCheck, UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ConsentCardProps {
    onAllow: () => void;
    onSilhouette: () => void;
    /** True while the permission prompt is open. */
    busy?: boolean;
}

/**
 * Privacy consent gate for camera use (Story 10 AC4 — charter requirement).
 *
 * This is the only component that can trigger `getUserMedia`, and it does so only
 * through an explicit button. Nothing on this card requests the camera on mount,
 * on focus, or as a side effect of the tab opening.
 *
 * The privacy claims are specific on purpose. "We respect your privacy" is
 * unfalsifiable marketing; "the video never leaves this tab, there is no
 * recording, no upload, and no server involved" is a statement a reviewer can
 * check against the code — and `preview.test.tsx` does exactly that by asserting a
 * `fetch` spy is never called anywhere in the AR flow.
 */
export function ConsentCard({ onAllow, onSilhouette, busy = false }: ConsentCardProps) {
    return (
        <section
            aria-labelledby="consent-heading"
            className="rounded-surface border border-violet/30 bg-violet/[0.07] p-5 backdrop-blur-xl shadow-glass"
        >
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet/40 bg-violet/15">
                    <ShieldCheck className="h-4 w-4 text-violet" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2
                        id="consent-heading"
                        className="font-display text-xl leading-tight text-white"
                    >
                        Before we turn on your camera
                    </h2>
                    <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-obsidian-400">
                        VibeFit uses your webcam so you can see a garment overlay on your own image.
                        You choose whether to enable it.
                    </p>
                </div>
            </div>

            <ul className="mt-4 flex flex-col gap-2.5">
                <ConsentPoint
                    icon={<Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                    title="Your video stays in this tab"
                >
                    Every frame is drawn locally by your browser. Nothing is recorded, stored, or
                    uploaded — not to a server, not to our own backend, nowhere. There is no image
                    retention of any kind.
                </ConsentPoint>

                <ConsentPoint
                    icon={<Camera className="h-3.5 w-3.5" aria-hidden="true" />}
                    title="We ask your browser for permission"
                >
                    Your browser will show its own permission prompt. Nothing is captured before
                    you accept, and you can revoke access at any time from your browser settings.
                </ConsentPoint>

                <ConsentPoint
                    icon={<UserRound className="h-3.5 w-3.5" aria-hidden="true" />}
                    title="You can skip the camera entirely"
                >
                    Silhouette mode shows the same garment overlay and the same alignment controls,
                    with a neutral body outline instead of your video feed.
                </ConsentPoint>
            </ul>

            <div className="mt-5 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onAllow}
                    disabled={busy}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-pill px-4 py-2.5',
                        'bg-champagne font-sans text-[0.8125rem] font-semibold text-obsidian',
                        'transition-colors hover:bg-champagne-200',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    {busy ? 'Waiting for permission…' : 'Enable camera'}
                </button>

                <button
                    type="button"
                    onClick={onSilhouette}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-white/[0.04] px-4 py-2.5 font-sans text-[0.8125rem] text-obsidian-50 transition-colors hover:border-white/30 hover:text-white"
                >
                    <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                    Use silhouette mode instead
                </button>
            </div>

            <p className="mt-3 text-[0.6875rem] leading-relaxed text-obsidian-500">
                Choosing silhouette mode does not ask for camera permission at all.
            </p>
        </section>
    );
}

function ConsentPoint({
    icon,
    title,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <li className="flex items-start gap-2.5">
            <span className="mt-0.5 text-violet/80">{icon}</span>
            <p className="text-[0.8125rem] leading-relaxed text-obsidian-400">
                <span className="font-medium text-obsidian-50">{title}. </span>
                {children}
            </p>
        </li>
    );
}
