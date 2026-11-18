import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PreferencesPage } from '@/features/preferences/PreferencesPage';
import { ResultsPage } from '@/features/results/ResultsPage';

/**
 * Sprint 1 has exactly two destinations. Anything unknown falls back to the
 * preference form rather than a dead route, which keeps a mistyped URL in a live
 * demo from producing a blank page.
 */
export function App() {
    return (
        <ErrorBoundary>
            <AppShell>
                <Routes>
                    <Route path="/" element={<Navigate to="/preferences" replace />} />
                    <Route path="/preferences" element={<PreferencesPage />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="*" element={<Navigate to="/preferences" replace />} />
                </Routes>
            </AppShell>
        </ErrorBoundary>
    );
}
