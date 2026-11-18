import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

/**
 * Last line of defence for the live demo.
 *
 * Acceptance criterion 8.4 forbids a broken screen. A render error in one
 * component would otherwise blank the entire app moments before a presentation,
 * so this catches it and offers a route back to a clean preference state.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Surfaced in the console so the team can diagnose after the demo, not during.
        console.error('VibeFit render error:', error, info.componentStack);
    }

    private handleReset = () => {
        try {
            window.localStorage.removeItem('vibefit:sprint1:v1');
        } catch {
            // Storage may be unavailable in private mode; a reload still recovers.
        }
        this.setState({ error: null });
        window.location.assign('/');
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="flex min-h-screen items-center justify-center px-6">
                <div className="w-full max-w-md rounded-surface border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
                    <AlertTriangle className="h-6 w-6 text-fit-tight" aria-hidden="true" />
                    <h1 className="mt-4 font-display text-2xl">Something went sideways</h1>
                    <p className="mt-2 text-sm text-obsidian-400">
                        VibeFit hit an unexpected error. Your saved preferences are intact; restarting
                        will rebuild the screen.
                    </p>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="mt-6 inline-flex items-center rounded-pill bg-champagne px-5 py-2.5 font-sans text-sm font-semibold text-obsidian transition-colors hover:bg-champagne-200"
                    >
                        Start again
                    </button>
                </div>
            </div>
        );
    }
}
