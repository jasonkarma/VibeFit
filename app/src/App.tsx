import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PreferencesPage } from '@/features/preferences/PreferencesPage';
import { ResultsPage } from '@/features/results/ResultsPage';
import { OutfitDetailPage } from '@/features/outfit/OutfitDetailPage';
import { PreviewPage } from '@/features/preview/PreviewPage';
import { SavedOutfitsPage } from '@/features/saved/SavedOutfitsPage';

/**
 * Routes.
 *
 * Sprint 1: /preferences → /results.
 * Sprint 2 adds /results/:outfitId (Story 6) and /results/:outfitId/preview
 * (Story 10). Saved outfits have their own routes and can be opened independently
 * of a recommendation session.
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
                    <Route path="/saved" element={<SavedOutfitsPage />} />
                    <Route path="/saved/:outfitId" element={<OutfitDetailPage fromSaved />} />
                    <Route path="/saved/:outfitId/preview" element={<PreviewPage fromSaved />} />
                    <Route path="*" element={<Navigate to="/preferences" replace />} />
                </Routes>
            </AppShell>
        </ErrorBoundary>
    );
}
