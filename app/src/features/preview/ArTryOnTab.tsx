import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, ScanFace, TriangleAlert } from 'lucide-react';
import type { Product } from '@/types/domain';
import { cn } from '@/lib/cn';
import { ConsentCard } from './ConsentCard';
import { AlignmentControls } from './AlignmentControls';
import { GarmentSwitcher } from './GarmentSwitcher';
import { CAMERA_FAILURE_COPY, useCameraStream } from './useCameraStream';
import { DEFAULT_OVERLAY_TRANSFORM, overlayStyle, type OverlayTransform } from './overlayTransform';
import { AR_GARMENTS, defaultArGarment } from './arGarments';
import { useShoulderTracking } from './useShoulderTracking';
import { AUTO_FOLLOW_CONFIDENCE } from './shoulderTracking';

interface ArTryOnTabProps {
    /** Every piece of the outfit, so "in this outfit" markers are accurate. */
    items: Product[];
}

/**
 * Tab 2 — live camera try-on (Story 10 AC3–AC6).
 *
 * Composition order is fixed and intentional: consent → stream → overlay. The tab
 * cannot reach the camera without passing through the consent card, because
 * `request()` is the only function that calls `getUserMedia` and only the consent
 * button calls `request()`.
 *
 * Mode is a four-way distinction, not a boolean:
 *   `consent`      — nothing requested yet, show the gate
 *   `camera`       — stream granted, show video + overlay
 *   `silhouette`   — user chose it, or the device refused; body outline + overlay
 *   `error`        — a failure worth naming, shown above the silhouette fallback
 *
 * The silhouette keeps every control live. A denied permission in a lecture hall
 * must demonstrate the feature, not an error screen.
 */
export function ArTryOnTab({ items }: ArTryOnTabProps) {
    const camera = useCameraStream();

    const [hasConsented, setHasConsented] = useState(false);
    /** True when the user explicitly picked the silhouette over the camera. */
    const [prefersSilhouette, setPrefersSilhouette] = useState(false);

    const [transform, setTransform] = useState<OverlayTransform>(DEFAULT_OVERLAY_TRANSFORM);

    const initialGarment = useMemo(() => defaultArGarment(items, AR_GARMENTS), [items]);
    const [selected, setSelected] = useState<Product | null>(initialGarment);

    const videoRef = useRef<HTMLVideoElement | null>(null);

    /*
     * Automatic shoulder tracking (Sprint 3).
     *
     * On by default once the camera is live, and switchable off. `hasManualOverride`
     * is what keeps the two systems from fighting: the moment the user touches a
     * slider, tracking suspends and stops writing to `transform`, so their adjustment
     * is final until they explicitly hand control back.
     *
     * The callback is wrapped so it also clears the manual flag on resume — a tiny
     * detail that matters: without it, "Resume tracking" would appear to do nothing
     * because the very next manual interaction would re-set the flag before the
     * tracker could write a value.
     */
    const [autoTrackEnabled, setAutoTrackEnabled] = useState(true);
    const [hasManualOverride, setHasManualOverride] = useState(false);

    const handleTrackedTransform = useCallback(
        (next: Pick<OverlayTransform, 'scale' | 'offsetX' | 'offsetY'>) => {
            setTransform((current) => ({ ...current, ...next }));
        },
        [],
    );

    const tracking = useShoulderTracking({
        videoRef,
        active: camera.isActive,
        enabled: autoTrackEnabled && !hasManualOverride,
        onTransform: handleTrackedTransform,
    });

    /** Any slider movement returns control to the user. */
    function handleManualTransform(next: OverlayTransform) {
        setHasManualOverride(true);
        setTransform(next);
    }

    function handleResumeTracking() {
        setHasManualOverride(false);
        tracking.resume();
    }

    /**
     * Attach the stream to the video element. `srcObject` is not settable from JSX,
     * and `play()` must be caught: autoplay rejection is normal on some browsers
     * even for a muted, user-initiated stream, and an unhandled rejection would
     * surface as a console error during the demo.
     */
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !camera.stream) return;

        video.srcObject = camera.stream;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                // Autoplay blocked: the stream is still attached and the user can
                // press play in the native control. Not worth interrupting for.
            });
        }

        return () => {
            video.srcObject = null;
        };
    }, [camera.stream]);

    const showCamera = camera.isActive && !prefersSilhouette;
    const showSilhouette = !showCamera;
    const failureReason = camera.reason;

    function handleAllow() {
        setPrefersSilhouette(false);
        setHasConsented(true);
        void camera.request();
    }

    function handleSilhouette() {
        // Choosing the silhouette must not request the camera at all.
        setPrefersSilhouette(true);
        setHasConsented(true);
        camera.stop();
    }

    function handleUseCamera() {
        setPrefersSilhouette(false);
        setHasConsented(true);
        void camera.request();
    }

    return (
        <div className="flex flex-col gap-5">
            {!hasConsented && (
                <ConsentCard
                    onAllow={handleAllow}
                    onSilhouette={handleSilhouette}
                    busy={camera.status === 'requesting'}
                />
            )}

            {/* Named failure, with the silhouette still usable underneath. */}
            {hasConsented && failureReason && showSilhouette && (
                <section
                    role="status"
                    aria-live="polite"
                    className="flex items-start gap-2.5 rounded-surface border border-fit-tight/35 bg-fit-tight/[0.08] p-4"
                >
                    <TriangleAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-fit-tight"
                        aria-hidden="true"
                    />
                    <div className="min-w-0">
                        <p className="text-[0.8125rem] leading-relaxed text-obsidian-50">
                            {CAMERA_FAILURE_COPY[failureReason]}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleUseCamera}
                                className="inline-flex items-center gap-1.5 rounded-pill border border-champagne/40 bg-champagne/10 px-3 py-1.5 font-sans text-[0.75rem] text-champagne transition-colors hover:bg-champagne/20"
                            >
                                <Camera className="h-3 w-3" aria-hidden="true" />
                                Try camera again
                            </button>
                            <button
                                type="button"
                                onClick={handleSilhouette}
                                className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 px-3 py-1.5 font-sans text-[0.75rem] text-obsidian-400 transition-colors hover:border-white/30 hover:text-white"
                            >
                                Continue with silhouette
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {hasConsented && (
                <>
                    {/* Stage */}
                    <div className="relative mx-auto w-full max-w-md">
                        <div
                            className={cn(
                                'relative aspect-[3/4] w-full overflow-hidden rounded-surface',
                                'border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.02]',
                                'shadow-glass-lg',
                            )}
                            data-testid="ar-stage"
                            data-stage-mode={showCamera ? 'camera' : 'silhouette'}
                        >
                            {showCamera ? (
                                <video
                                    ref={videoRef}
                                    className="h-full w-full scale-x-[-1] object-cover"
                                    playsInline
                                    muted
                                    autoPlay
                                    aria-label="Live camera preview"
                                />
                            ) : (
                                <SilhouetteStage />
                            )}

                            {/*
                              Tracking status chip. Only rendered in camera mode —
                              silhouette mode has no frame to analyse, and implying
                              otherwise would be dishonest about what is happening.
                            */}
                            {showCamera && (
                                <span
                                    data-testid="tracking-status"
                                    data-tracking-status={tracking.status}
                                    className={cn(
                                        'absolute right-2 top-2 inline-flex items-center gap-1 rounded-pill border px-2 py-0.5',
                                        'font-data text-[0.5rem] uppercase tracking-[0.1em] backdrop-blur-md',
                                        tracking.autoFollowing
                                            ? 'border-fit-comfortable/45 bg-fit-comfortable/15 text-fit-comfortable'
                                            : 'border-white/20 bg-obsidian/70 text-obsidian-400',
                                    )}
                                >
                                    <ScanFace className="h-2.5 w-2.5" aria-hidden="true" />
                                    {tracking.autoFollowing
                                        ? 'Shoulders locked'
                                        : tracking.status === 'searching'
                                            ? 'Finding shoulders'
                                            : 'Manual alignment'}
                                </span>
                            )}

                            {/* Garment overlay */}
                            {selected?.overlayAsset && (
                                <img
                                    src={selected.overlayAsset}
                                    alt={`${selected.name} overlay`}
                                    data-testid="ar-overlay"
                                    className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                                    style={overlayStyle(transform)}
                                />
                            )}

                            <span className="absolute left-2 top-2 rounded-pill border border-champagne/35 bg-obsidian/80 px-2 py-0.5 font-data text-[0.5625rem] uppercase tracking-[0.12em] text-champagne/90 backdrop-blur-md">
                                Illustrative Prototype
                            </span>

                            {camera.status === 'requesting' && (
                                <div
                                    className="absolute inset-0 flex items-center justify-center bg-obsidian/70"
                                    role="status"
                                    aria-live="polite"
                                >
                                    <p className="font-data text-[0.6875rem] uppercase tracking-[0.1em] text-obsidian-400">
                                        Waiting for camera permission…
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Mode switch */}
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                            {showCamera ? (
                                <button
                                    type="button"
                                    onClick={camera.stop}
                                    className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 px-3 py-1.5 font-sans text-[0.75rem] text-obsidian-400 transition-colors hover:border-white/30 hover:text-white"
                                >
                                    <CameraOff className="h-3 w-3" aria-hidden="true" />
                                    Stop camera
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleUseCamera}
                                    className="inline-flex items-center gap-1.5 rounded-pill border border-violet/40 bg-violet/15 px-3 py-1.5 font-sans text-[0.75rem] text-violet transition-colors hover:bg-violet/25 hover:text-white"
                                >
                                    <Camera className="h-3 w-3" aria-hidden="true" />
                                    Switch to camera
                                </button>
                            )}

                            {showCamera && (
                                <button
                                    type="button"
                                    onClick={handleSilhouette}
                                    className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 px-3 py-1.5 font-sans text-[0.75rem] text-obsidian-400 transition-colors hover:border-white/30 hover:text-white"
                                >
                                    Use silhouette instead
                                </button>
                            )}
                        </div>

                        {showCamera && (
                            <p className="mt-2 text-center font-data text-[0.5625rem] uppercase tracking-[0.1em] text-obsidian-500">
                                Video stays in this tab · nothing recorded or uploaded
                            </p>
                        )}
                    </div>

                    {selected && (
                        <p className="text-center text-[0.8125rem] text-obsidian-400">
                            Trying on{' '}
                            <span className="text-white">{selected.name}</span> by{' '}
                            {selected.retailer}
                        </p>
                    )}

                    <GarmentSwitcher
                        garments={AR_GARMENTS}
                        selectedId={selected?.id ?? null}
                        onSelect={setSelected}
                        outfitItemIds={items.map((item) => item.id)}
                    />

                    {/*
                      Tracking control. Shown only in camera mode, because there is
                      nothing to track otherwise — an enabled toggle in silhouette mode
                      would be a promise the device cannot keep.
                    */}
                    {showCamera && (
                        <section
                            aria-labelledby="tracking-heading"
                            className="rounded-surface border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <h2
                                        id="tracking-heading"
                                        className="font-display text-base leading-tight text-white"
                                    >
                                        Automatic shoulder tracking
                                    </h2>
                                    <p className="mt-0.5 text-[0.75rem] leading-relaxed text-obsidian-400">
                                        {hasManualOverride
                                            ? 'Paused while you align it by hand. Resume to let it follow you again.'
                                            : tracking.autoFollowing
                                                ? `Following your shoulders. Confidence ${Math.round(
                                                    (tracking.estimate?.confidence ?? 0) * 100,
                                                )}%.`
                                                : 'Looking for your shoulders. Stand centred and face the camera.'}
                                    </p>
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    {hasManualOverride ? (
                                        <button
                                            type="button"
                                            onClick={handleResumeTracking}
                                            className="inline-flex items-center gap-1.5 rounded-pill border border-champagne/40 bg-champagne/10 px-3 py-1.5 font-sans text-[0.75rem] text-champagne transition-colors hover:bg-champagne/20"
                                        >
                                            <ScanFace className="h-3 w-3" aria-hidden="true" />
                                            Resume tracking
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setAutoTrackEnabled((on) => !on)}
                                            aria-pressed={autoTrackEnabled}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5',
                                                'font-sans text-[0.75rem] transition-colors',
                                                autoTrackEnabled
                                                    ? 'border-champagne/40 bg-champagne/10 text-champagne hover:bg-champagne/20'
                                                    : 'border-white/15 text-obsidian-400 hover:border-white/30 hover:text-white',
                                            )}
                                        >
                                            <ScanFace className="h-3 w-3" aria-hidden="true" />
                                            {autoTrackEnabled ? 'Tracking on' : 'Tracking off'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <p className="mt-2 font-data text-[0.5625rem] uppercase tracking-[0.1em] text-obsidian-500">
                                Estimates a shoulder line from the frame on your device · nothing is
                                uploaded or stored ·{' '}
                                {Math.round(AUTO_FOLLOW_CONFIDENCE * 100)}% confidence required to move
                                the garment
                            </p>
                        </section>
                    )}

                    <AlignmentControls value={transform} onChange={handleManualTransform} />
                </>
            )}
        </div>
    );
}

/**
 * Silhouette fallback.
 *
 * A neutral figure rather than a stock model: it makes the garment the only thing
 * with detail, which is the honest way to present a try-on without a camera. It is
 * `aria-hidden` decoration — the overlay's own alt text and the panel headings carry
 * the meaning.
 */
function SilhouetteStage() {
    return (
        <div
            className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_20%,rgba(229,193,88,0.08),transparent_65%)]"
            data-testid="ar-silhouette"
        >
            <svg
                viewBox="0 0 240 320"
                className="h-full w-full"
                fill="none"
                aria-hidden="true"
            >
                {/* Head */}
                <circle
                    cx="120"
                    cy="62"
                    r="30"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="2"
                    fill="rgba(255,255,255,0.03)"
                />
                {/* Neck and torso */}
                <path
                    d="M104 92 L104 106 C74 116 58 136 54 168 L48 236 C47 246 54 252 62 252 L178 252 C186 252 193 246 192 236 L186 168 C182 136 166 116 136 106 L136 92"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    fill="rgba(255,255,255,0.03)"
                />
                {/* Legs */}
                <path
                    d="M92 252 L88 312 M148 252 L152 312"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                {/* Shoulder reference line so the user can judge placement */}
                <path
                    d="M76 122 L164 122"
                    stroke="rgba(229,193,88,0.28)"
                    strokeWidth="1.5"
                    strokeDasharray="4 6"
                />
                <text
                    x="120"
                    y="298"
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.28)"
                    fontFamily="ui-monospace, monospace"
                    fontSize="9"
                    letterSpacing="1.5"
                >
                    SILHOUETTE MODE
                </text>
            </svg>
        </div>
    );
}
