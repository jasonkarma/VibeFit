import { motion, useAnimationControls } from 'framer-motion';
import { useId, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { FieldError } from '@/components/ui/FieldError';
import { BudgetTierBar } from './BudgetTierBar';
import { useMotion, shakeKeyframes } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { sanitizeBudgetTyping } from './validation';

interface BudgetInputProps {
    value: string;
    parsedAmount: number | null;
    error?: string;
    onChange: (raw: string) => void;
    /** Reveals inline errors only after the user has left the field or submitted. */
    onBlur?: () => void;
}

/**
 * VIBE-14 — Set Outfit Budget.
 *
 * A real numeric text input is the control. It is not replaced by a slider,
 * because acceptance criterion 14.2 requires rejecting zero, negative, and
 * non-numeric entries with a helpful message — a slider makes those states
 * unreachable and therefore untestable. The tier bar sits beside it purely as
 * orientation.
 *
 * Errors are suppressed while the user is mid-typing but shown on blur, so the
 * field never scolds someone who has typed a single digit of a larger number.
 */
export function BudgetInput({ value, parsedAmount, error, onChange, onBlur }: BudgetInputProps) {
    const { reduced, shake } = useMotion();
    const inputId = useId();
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const controls = useAnimationControls();
    const [touched, setTouched] = useState(false);

    const showError = Boolean(error) && touched;

    function handleChange(raw: string) {
        onChange(sanitizeBudgetTyping(raw));
    }

    function handleBlur() {
        setTouched(true);
        if (error) {
            // Imperative shake rather than a key-based remount: re-keying the wrapper
            // would unmount the input, dropping focus and caret position mid-edit.
            void controls.start({ x: shakeKeyframes, transition: shake });
        }
        onBlur?.();
    }

    return (
        <div>
            <motion.div animate={controls} className="relative">
                <label
                    htmlFor={inputId}
                    className="mb-2 block text-[0.8125rem] uppercase tracking-[0.08em] text-obsidian-400"
                >
                    Total clothing budget
                </label>

                <div
                    className={cn(
                        'flex items-center gap-2 rounded-tile border bg-white/[0.03] px-4 py-3',
                        'backdrop-blur-xl transition-colors',
                        showError
                            ? 'border-fit-over/60'
                            : 'border-white/10 focus-within:border-champagne/60',
                    )}
                >
                    <DollarSign className="h-4 w-4 shrink-0 text-obsidian-500" aria-hidden="true" />
                    <input
                        id={inputId}
                        name="budget"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="250"
                        value={value}
                        onChange={(event) => handleChange(event.target.value)}
                        onBlur={handleBlur}
                        aria-invalid={showError}
                        aria-describedby={showError ? `${errorId} ${hintId}` : hintId}
                        className="w-full bg-transparent font-data text-lg text-white outline-none placeholder:text-obsidian-500"
                    />
                    <span className="shrink-0 font-data text-[0.6875rem] uppercase tracking-[0.1em] text-obsidian-500">
                        USD
                    </span>
                </div>

                <FieldError id={errorId}>{showError ? error : undefined}</FieldError>
            </motion.div>

            <div id={hintId} className="mt-4">
                <BudgetTierBar amount={parsedAmount} />
            </div>
        </div>
    );
}
