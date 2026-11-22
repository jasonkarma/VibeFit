import { Users, UserRound, PersonStanding } from 'lucide-react';
import type { Department } from '@/types/domain';
import { DEPARTMENTS } from '@/types/domain';
import { cn } from '@/lib/cn';

interface DepartmentSelectorProps {
    value: Department;
    onChange: (department: Department) => void;
}

const DESCRIPTORS: Record<Department, { label: string; blurb: string; icon: typeof Users }> = {
    All: {
        label: 'All',
        blurb: 'Show every outfit in the collection',
        icon: Users,
    },
    Womenswear: {
        label: 'Womenswear',
        blurb: 'Styled and sized for womenswear',
        icon: PersonStanding,
    },
    Menswear: {
        label: 'Menswear',
        blurb: 'Styled and sized for menswear',
        icon: UserRound,
    },
};

/**
 * Optional department / gender preference (Sprint 3).
 *
 * Three caveats shaped this control:
 *
 *  1. **It is optional and defaults to `All`.** The field did not exist in Sprint
 *     1 or 2, so defaulting to a concrete department would silently change what a
 *     returning user sees. `All` means "as it was", which is the only safe default.
 *  2. **No validation error is possible.** There is no invalid state, so the
 *     selector never renders a message. A field that cannot be wrong should not
 *     threaten the user with red text.
 *  3. **It does not gate generation.** Being optional, it must not read as required
 *     — hence the "Optional" marker in the section heading rather than an asterisk.
 *
 * Radio semantics via `aria-pressed` toggle buttons, matching the pill pattern used
 * elsewhere, so keyboard and screen-reader behaviour is consistent across the form.
 */
export function DepartmentSelector({ value, onChange }: DepartmentSelectorProps) {
    return (
        <div>
            <div
                role="group"
                aria-label="Department"
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
                {DEPARTMENTS.map((department) => {
                    const { label, blurb, icon: Icon } = DESCRIPTORS[department];
                    const selected = value === department;

                    return (
                        <button
                            key={department}
                            type="button"
                            onClick={() => onChange(department)}
                            aria-pressed={selected}
                            className={cn(
                                'flex items-start gap-2.5 rounded-tile border px-3.5 py-3 text-left',
                                'transition-colors duration-150',
                                selected
                                    ? 'border-champagne/60 bg-champagne/10'
                                    : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]',
                            )}
                        >
                            <Icon
                                className={cn(
                                    'mt-0.5 h-4 w-4 shrink-0',
                                    selected ? 'text-champagne' : 'text-obsidian-500',
                                )}
                                aria-hidden="true"
                            />
                            <span className="min-w-0">
                                <span
                                    className={cn(
                                        'block font-sans text-[0.875rem] font-medium',
                                        selected ? 'text-white' : 'text-obsidian-50',
                                    )}
                                >
                                    {label}
                                </span>
                                <span className="mt-0.5 block text-[0.6875rem] leading-snug text-obsidian-500">
                                    {blurb}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-obsidian-500">
                Leave this on <span className="text-obsidian-400">All</span> and we will show the
                whole collection. Choose a department only to narrow it.
            </p>
        </div>
    );
}
