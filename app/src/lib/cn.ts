import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class strings so later utilities win over earlier ones
 * without duplicate-class bugs (`bg-white/[0.03]` vs `bg-white/[0.05]`).
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
