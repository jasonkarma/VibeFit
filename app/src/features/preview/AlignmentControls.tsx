import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
    DEFAULT_OVERLAY_TRANSFORM,
    TRANSFORM_LIMITS,
    type OverlayTransform,
} from './overlayTransform';

interface AlignmentControlsProps {
    value: OverlayTransform;
    initialAlignment?: OverlayTransform;
    onChange: (next: OverlayTransform) => void;
    /** Names the control so screen-reader users know which way is "up". */
    className?: string;
}

interface SliderSpec {
    key: keyof typeof TRANSFORM_LIMITS;
    label: string;
    hint: string;
    /** Suffix shown next to the live value. */
    unit: string;
}

/**
 * The four sliders (Story 10 AC6).
 *
 * Each is a native `<input type="range">` with a real `<label for>` and a visible
 * numeric readout in the mono role. That combination matters: a slider whose value
 * only exists as thumb position is unusable for anyone who cannot see precisely
 * where the thumb is, and untestable without computed-style gymnastics.
 *
 * `aria-valuetext` restates the value with its unit so the announcement is
 * "Horizontal offset, 12 percent left" rather than the bare number.
 */
const SLIDERS: SliderSpec[] = [
    { key: 'scale', label: 'Scale', hint: 'Garment size', unit: '%' },
    { key: 'offsetX', label: 'Horizontal', hint: 'Left / right', unit: '%' },
    { key: 'offsetY', label: 'Vertical', hint: 'Up / down', unit: '%' },
    { key: 'opacity', label: 'Opacity', hint: 'Garment transparency', unit: '%' },
];

export function AlignmentControls({ value, initialAlignment = DEFAULT_OVERLAY_TRANSFORM, onChange, className }: AlignmentControlsProps) {
    const isDefault =
        value.scale === initialAlignment.scale &&
        value.offsetX === initialAlignment.offsetX &&
        value.offsetY === initialAlignment.offsetY &&
        value.opacity === initialAlignment.opacity;

    return (
        <section
            aria-labelledby="alignment-heading"
            className={cn(
                'rounded-surface border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-glass',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 id="alignment-heading" className="font-display text-lg text-white">
                        Align the garment
                    </h2>
                    <p className="mt-0.5 text-[0.75rem] text-obsidian-400">
                        Position the piece over your shoulders. Nothing here is measured
                        automatically.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => onChange({ ...initialAlignment })}
                    disabled={isDefault}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-white/10 px-3 py-1.5 font-sans text-[0.75rem] text-obsidian-400 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Reset alignment
                </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {SLIDERS.map((spec) => {
                    const range = TRANSFORM_LIMITS[spec.key];
                    const current = value[spec.key];

                    return (
                        <div key={spec.key}>
                            <div className="flex items-baseline justify-between gap-2">
                                <label
                                    htmlFor={`overlay-${spec.key}`}
                                    className="font-sans text-[0.8125rem] font-medium text-obsidian-50"
                                >
                                    {spec.label}
                                    <span className="ml-1.5 font-normal text-obsidian-500">
                                        {spec.hint}
                                    </span>
                                </label>
                                <output
                                    htmlFor={`overlay-${spec.key}`}
                                    className="font-data text-[0.75rem] text-champagne"
                                    data-testid={`overlay-value-${spec.key}`}
                                >
                                    {current}
                                    {spec.unit}
                                </output>
                            </div>

                            <input
                                id={`overlay-${spec.key}`}
                                type="range"
                                min={range.min}
                                max={range.max}
                                step={1}
                                value={current}
                                aria-valuetext={describeValue(spec, current)}
                                onChange={(event) =>
                                    onChange({ ...value, [spec.key]: Number(event.target.value) })
                                }
                                className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-white/10 accent-champagne"
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function describeValue(spec: SliderSpec, value: number): string {
    // Direction words make the announcement self-explanatory; a bare "-12%" does not.
    if (spec.key === 'offsetX') {
        if (value === 0) return 'Centred horizontally';
        return `${Math.abs(value)} percent ${value < 0 ? 'left' : 'right'}`;
    }
    if (spec.key === 'offsetY') {
        if (value === 0) return 'Centred vertically';
        return `${Math.abs(value)} percent ${value < 0 ? 'up' : 'down'}`;
    }
    return `${value} ${spec.key === 'scale' ? 'percent scale' : 'percent opacity'}`;
}
