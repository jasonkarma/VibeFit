import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useMotion } from '@/lib/motion';

interface PageTransitionProps {
    children: ReactNode;
}

/**
 * Route-level fade and lift.
 *
 * Content is in the DOM from the first render at full opacity in reduced-motion
 * and test environments, so a route transition can never delay a query or hide
 * an element from an assertion.
 */
export function PageTransition({ children }: PageTransitionProps) {
    const { page } = useMotion();

    return (
        <motion.div variants={page} initial="initial" animate="animate" exit="exit">
            {children}
        </motion.div>
    );
}
