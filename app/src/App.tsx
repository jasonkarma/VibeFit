import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PreferencesPage } from '@/features/preferences/PreferencesPage';
import { ResultsPage } from '@/features/results/ResultsPage';
import { OutfitDetailPage } from '@/features/outfit/OutfitDetailPage';
import { PreviewPage } from '@/features/preview/PreviewPage';

/**
 * Routes.
 *
 * Sprint 1: /preferences → /results.
 * Sprint 2 adds /results/:outfitId (Story 6) and /results/:outfitId/preview
 * (Story 10). Both sit under the results path so the parent guard applies and the
 * URL reads as a drill-down from the recommendation grid.
 *
 * Anything unknown falls back to the preference form rather than a dead route,
 * which keeps a mistyped URL in a live demo from producing a blank page.
 */
export function App() {
    return (
        <ErrorBoundary>
            <AppShell>
                <Routes>
                    <Route path="/" element={<Navigate to="/preferences" replace />} />
                    <Route path="/preferences" element={<PreferencesPage />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="/results/:outfitId" element={<OutfitDetailPage />} />
                    <Route path="/results/:outfitId/preview" element={<PreviewPage />} />
                    <Route path="*" element={<Navigate to="/preferences" replace />} />
                </Routes>
            </AppShell>
        </ErrorBoundary>
    );
}
