import { budgetTierFor, budgetTiers } from '@/styles/tokens';
import { cn } from '@/lib/cn';

interface BudgetTierBarProps {
    /** Parsed budget, or null while the field is empty or invalid. */
    amount: number | null;
}

/**
 * Live tier hint beside the budget field.
 *
 * Strictly non-authoritative by design: it never writes a value and never
 * validates one. The text input remains the only source of truth, so this
 * decoration cannot become a back door around acceptance criterion 14.2
 * (rejecting zero, negative, and non-numeric budgets).
 *
 * It answers a real question though — "is $180 a reasonable number?" — which a
 * bare numeric field leaves the user guessing about.
 */
export function BudgetTierBar({ amount }: BudgetTierBarProps) {
    const active = amount !== null ? budgetTierFor(amount) : null;
    const activeIndex = active ? budgetTiers.findIndex((t) => t.id === active.id) : -1;

    return (
        <div aria-live="polite">
            <div className="flex gap-1" aria-hidden="true">
                {budgetTiers.map((tier, index) => (
                    <div
                        key={tier.id}
                        className={cn(
                            'h-1 flex-1 rounded-pill transition-colors duration-300',
                            index <= activeIndex && activeIndex >= 0 ? 'bg-champagne' : 'bg-white/10',
                        )}
                    />
                ))}
            </div>

            <p className="mt-2 text-[0.75rem] leading-relaxed text-obsidian-400">
                {active ? (
                    <>
                        <span className="text-white">{active.label}</span>
                        <span className="text-obsidian-500"> — {active.blurb}</span>
                    </>
                ) : (
                    <span className="text-obsidian-500">
                        Enter an amount to see which range of pieces it unlocks.
                    </span>
                )}
            </p>
        </div>
    );
}
