import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import { usePreferencesStore } from '@/store/preferencesStore';
import { EMPTY_PREFERENCES } from '@/types/domain';
import { AR_GARMENTS } from '../arGarments';
import { FIT_DISCLAIMER } from '../PreviewPage';
import {
    DEFAULT_OVERLAY_TRANSFORM,
    clampTransform,
    overlayStyle,
} from '../overlayTransform';

/**
 * Story 10 and the charter AR scope.
 *
 * Testing mechanics worth knowing before editing this file:
 *
 *  • `navigator.mediaDevices` is undefined in jsdom. That is itself the
 *    "unsupported browser" case, and several tests below rely on it.
 *  • Tests that need a camera install a stub with `Object.defineProperty` and
 *    `afterEach` deletes it, so a granted camera can never leak between tests.
 *  • Track fixtures expose `stop()` as a spy, so "the camera was released" is
 *    asserted rather than assumed.
 *  • No animation waiting: `MOTION_DISABLED` collapses every preset under Vitest.
 */

function renderAt(path: string) {
    return render(
        <MemoryRouter
            initialEntries={[path]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <App />
        </MemoryRouter>,
    );
}

function seedPreferences() {
    usePreferencesStore.setState({
        preferences: {
            ...EMPTY_PREFERENCES,
            occasion: 'Work',
            dressCode: 'Business Formal',
            budgetInput: '400',
            budget: 400,
            styles: ['Classic'],
            colors: ['Navy'],
        },
    });
}

/** Minimal fake stream: two tracks, both with a `stop` spy. */
function fakeStream() {
    const stop = vi.fn();
    const stream = {
        getTracks: () => [{ stop }, { stop }],
        getVideoTracks: () => [{ stop }],
    } as unknown as MediaStream;
    return { stream, stop };
}

/**
 * Drive a range input the way a drag does.
 *
 * `user.type`/`user.clear` are the wrong model here: a range input is not
 * text-editable, so user-event refuses. A `change` event is exactly what a real
 * slider drag emits.
 */
function setRange(label: RegExp, value: number) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

/**
 * Install a `mediaDevices` stub.
 * `getUserMedia` resolves with a fake stream, or rejects with the given error name.
 */
function installCamera(result: { errorName: string } | { grant: true }) {
    const { stream, stop } = fakeStream();

    const getUserMedia = vi.fn(() =>
        'errorName' in result
            ? Promise.reject(
                Object.assign(new Error('camera failed'), { name: result.errorName }),
            )
            : Promise.resolve(stream),
    );

    Object.defineProperty(window.navigator, 'mediaDevices', {
        configurable: true,
        writable: true,
        value: { getUserMedia },
    });

    return { getUserMedia, stop };
}

beforeEach(() => {
    usePreferencesStore.getState().reset();
    seedPreferences();
    usePreferencesStore.getState().generate();
});

afterEach(() => {
    // Remove the stub so the next test starts from jsdom's default: no camera API.
    Reflect.deleteProperty(window.navigator as unknown as Record<string, unknown>, 'mediaDevices');
});

describe('Story 10 AC1 — preview route and navigation', () => {
    it('renders both tabs and closes back to the outfit detail', async () => {
        const user = userEvent.setup();
        renderAt('/results/o-08/preview');

        const tablist = await screen.findByRole('tablist', { name: /preview mode/i });
        expect(within(tablist).getAllByRole('tab')).toHaveLength(2);
        expect(screen.getByRole('tab', { name: /combined look/i })).toHaveAttribute(
            'aria-selected',
            'true',
        );

        await user.click(screen.getByRole('button', { name: /close preview/i }));

        // Back on the detail screen.
        expect(
            await screen.findByRole('heading', { level: 1, name: /boardroom standard/i }),
        ).toBeVisible();
        expect(
            screen.getByRole('button', { name: /preview & ar try-on/i }),
        ).toBeVisible();
    });

    it('disables the AR tab for an outfit with no supported garment', async () => {
        renderAt('/results/o-21/preview');

        const arTab = await screen.findByRole('tab', { name: /ar try-on/i });
        expect(arTab).toBeDisabled();
        expect(screen.getByRole('tab', { name: /combined look/i })).toHaveAttribute(
            'aria-selected',
            'true',
        );
    });
});

describe('Story 10 AC2 — combined look', () => {
    it('assembles every piece under the prototype label', async () => {
        renderAt('/results/o-08/preview');

        expect(await screen.findByTestId('combined-look-label')).toHaveTextContent(
            'Illustrative Prototype Preview',
        );

        const pieceList = screen.getByRole('list', { name: /outfit pieces/i });
        // o-08 has five pieces after the Sprint 2 catalog addition.
        expect(within(pieceList).getAllByRole('listitem')).toHaveLength(5);

        // Every visual is badged as a prototype, and the label is not ambiguous.
        expect(screen.getAllByText(/prototype visual/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/not product photography/i)).toBeVisible();
    });
});

describe('Story 10 AC4 — privacy consent gate', () => {
    it('never touches getUserMedia before consent', async () => {
        const { getUserMedia } = installCamera({ grant: true });

        renderAt('/results/o-08/preview');
        await userEvent.setup().click(screen.getByRole('tab', { name: /ar try-on/i }));

        // The consent card is showing and the camera is untouched.
        expect(
            await screen.findByRole('heading', { name: /before we turn on your camera/i }),
        ).toBeVisible();
        expect(getUserMedia).not.toHaveBeenCalled();
    });

    it('states that video stays local with no retention or upload', async () => {
        renderAt('/results/o-08/preview');
        await userEvent.setup().click(screen.getByRole('tab', { name: /ar try-on/i }));

        const card = await screen.findByRole('region', {
            name: /before we turn on your camera/i,
        });

        expect(within(card).getByText(/stays in this tab/i)).toBeVisible();
        expect(within(card).getByText(/nothing is recorded, stored, or uploaded/i)).toBeVisible();
        expect(within(card).getByText(/no image retention/i)).toBeVisible();
    });

    it('requests the camera exactly once after explicit consent', async () => {
        const { getUserMedia } = installCamera({ grant: true });
        const user = userEvent.setup();

        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

        // Only video: requesting audio for a try-on would be indefensible.
        const constraints = (getUserMedia.mock.calls[0] as unknown[])[0] as MediaStreamConstraints;
        expect(constraints.video).toBeTruthy();
        expect(constraints.audio).toBe(false);
    });

    it('never calls fetch anywhere in the AR flow (nothing is uploaded)', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        installCamera({ grant: true });
        const user = userEvent.setup();

        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));
        await screen.findByTestId('ar-overlay');

        // The privacy claim is architectural, and this is the proof.
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});

describe('Story 10 AC3 — AR garments and switching', () => {
    it('offers every supported top and jacket', async () => {
        const user = userEvent.setup();
        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /use silhouette mode/i }));

        const switcher = await screen.findByRole('list', { name: /ar-supported garments/i });
        const buttons = within(switcher).getAllByRole('button');

        // Count is derived from the catalog, not a literal: Sprint 3 added two
        // menswear garments alongside the original five.
        expect(buttons).toHaveLength(AR_GARMENTS.length);
        for (const garment of AR_GARMENTS) {
            expect(within(switcher).getByText(garment.name)).toBeVisible();
        }
    });

    it("selects the outfit's own garment by default and switches on click", async () => {
        const user = userEvent.setup();
        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /use silhouette mode/i }));

        const switcher = await screen.findByRole('list', { name: /ar-supported garments/i });

        // o-08 holds the wool blazer, so that starts selected.
        const blazer = within(switcher)
            .getByText('Wool-Blend Single-Breasted Blazer')
            .closest('button')!;
        expect(blazer).toHaveAttribute('aria-pressed', 'true');

        const moto = within(switcher).getByText('Leather Moto Jacket').closest('button')!;
        await user.click(moto);

        expect(moto).toHaveAttribute('aria-pressed', 'true');
        expect(blazer).toHaveAttribute('aria-pressed', 'false');

        const overlay = screen.getByTestId('ar-overlay');
        expect(overlay).toHaveAttribute('src', '/ar/leather-moto.svg');
    });

    it("marks the outfit's own pieces so the list is never ambiguous", async () => {
        const user = userEvent.setup();
        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /use silhouette mode/i }));

        const switcher = await screen.findByRole('list', { name: /ar-supported garments/i });
        expect(within(switcher).getByText(/in this outfit/i)).toBeVisible();
    });
});

describe('Story 10 AC5 — camera failure fallback', () => {
    it('falls back to an interactive silhouette when permission is denied', async () => {
        installCamera({ errorName: 'NotAllowedError' });
        const user = userEvent.setup();

        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        // Named failure, not a blank stage.
        expect(
            await screen.findByText(/camera permission was declined/i),
        ).toBeVisible();

        const stage = screen.getByTestId('ar-stage');
        expect(stage.getAttribute('data-stage-mode')).toBe('silhouette');
        expect(screen.getByTestId('ar-silhouette')).toBeVisible();

        // The tab stays fully usable: overlay + controls still present.
        expect(screen.getByTestId('ar-overlay')).toBeVisible();
        expect(screen.getByLabelText(/scale/i)).toBeVisible();
    });

    it('falls back when the device has no camera', async () => {
        installCamera({ errorName: 'NotFoundError' });
        const user = userEvent.setup();

        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        expect(await screen.findByText(/no camera was found/i)).toBeVisible();
        expect(screen.getByTestId('ar-silhouette')).toBeVisible();
    });

    it('falls back when the browser exposes no camera API at all', async () => {
        // No stub installed: jsdom has no `navigator.mediaDevices`.
        const user = userEvent.setup();

        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        expect(
            await screen.findByText(/does not expose a camera api/i),
        ).toBeVisible();
        expect(screen.getByTestId('ar-silhouette')).toBeVisible();
    });

    it('reports a busy device distinctly from a denial', async () => {
        installCamera({ errorName: 'NotReadableError' });
        const user = userEvent.setup();

        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        expect(await screen.findByText(/already in use by another application/i)).toBeVisible();
    });

    it('choosing silhouette mode never requests the camera', async () => {
        const { getUserMedia } = installCamera({ grant: true });
        const user = userEvent.setup();

        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /use silhouette mode/i }));

        await screen.findByTestId('ar-silhouette');
        expect(getUserMedia).not.toHaveBeenCalled();
    });
});

describe('Story 10 AC6 — alignment controls', () => {
    it('applies scale, horizontal, vertical and opacity to the overlay', async () => {
        const user = userEvent.setup();
        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /use silhouette mode/i }));

        const overlay = await screen.findByTestId('ar-overlay');

        // Defaults.
        expect(overlay.style.transform).toContain('scale(1)');
        expect(overlay.style.opacity).toBe('0.9');

        // `fireEvent.change` rather than `user.type`: a range input is not text-
        // editable, so typing/clearing is the wrong model. This fires exactly the
        // event a real drag produces.
        setRange(/scale/i, 130);
        setRange(/horizontal/i, -20);
        setRange(/vertical/i, 15);
        setRange(/opacity/i, 55);

        const style = overlay.style;
        expect(style.transform).toContain('scale(1.3)');
        expect(style.transform).toContain('translate(-20%');
        expect(style.transform).toContain('15%');
        expect(style.opacity).toBe('0.55');
    });

    it('shows a live numeric readout and resets to defaults', async () => {
        const user = userEvent.setup();
        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /use silhouette mode/i }));

        setRange(/scale/i, 140);
        expect(screen.getByTestId('overlay-value-scale')).toHaveTextContent('140%');

        await user.click(screen.getByRole('button', { name: /reset alignment/i }));
        expect(screen.getByTestId('overlay-value-scale')).toHaveTextContent('100%');
    });

    it('labels each control for assistive technology', async () => {
        const user = userEvent.setup();
        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /use silhouette mode/i }));

        for (const label of [/scale/i, /horizontal/i, /vertical/i, /opacity/i]) {
            const input = screen.getByLabelText(label);
            expect(input).toHaveAttribute('type', 'range');
            expect(input).toHaveAttribute('aria-valuetext');
        }
    });
});

describe('Story 10 AC7 — sizing disclaimer', () => {
    it('is present in the combined look tab', async () => {
        renderAt('/results/o-08/preview');
        expect(await screen.findByTestId('fit-disclaimer')).toHaveTextContent(FIT_DISCLAIMER);
    });

    it('is present in the AR tab too', async () => {
        const user = userEvent.setup();
        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));

        expect(await screen.findByTestId('fit-disclaimer')).toHaveTextContent(FIT_DISCLAIMER);
        // Verbatim, per the acceptance criterion.
        expect(
            screen.getByText(
                'Visual appearance preview only — does not guarantee exact sizing or fit.',
            ),
        ).toBeVisible();
    });
});

describe('charter — camera lifecycle', () => {
    it('releases every track when the camera is stopped', async () => {
        const { stop } = installCamera({ grant: true });
        const user = userEvent.setup();

        renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        await waitFor(() => {
            expect(screen.getByTestId('ar-stage').getAttribute('data-stage-mode')).toBe('camera');
        });

        await user.click(screen.getByRole('button', { name: /stop camera/i }));

        // Both fake tracks were stopped: the device light goes out.
        expect(stop).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('ar-silhouette')).toBeVisible();
    });

    it('stops tracks on unmount, so no stream outlives the page', async () => {
        const { stop } = installCamera({ grant: true });
        const user = userEvent.setup();

        const { unmount } = renderAt('/results/o-08/preview');
        await user.click(screen.getByRole('tab', { name: /ar try-on/i }));
        await user.click(await screen.findByRole('button', { name: /enable camera/i }));

        await waitFor(() => {
            expect(screen.getByTestId('ar-stage').getAttribute('data-stage-mode')).toBe('camera');
        });

        unmount();
        expect(stop).toHaveBeenCalled();
    });
});

describe('overlay transform maths', () => {
    it('builds a translate-then-scale string with a collar anchor', () => {
        const style = overlayStyle({ scale: 120, offsetX: -10, offsetY: 5, opacity: 70 });
        expect(style.transform).toBe('translate(-10%, 5%) scale(1.2)');
        expect(style.opacity).toBe(0.7);
        // Anchoring at the collar keeps a scaled jacket on the shoulders.
        expect(style.transformOrigin).toBe('50% 40%');
    });

    it('clamps out-of-range and non-finite values instead of emitting broken CSS', () => {
        const clamped = clampTransform({
            scale: 5000,
            offsetX: -999,
            offsetY: 999,
            opacity: Number.NaN,
        });

        expect(clamped.scale).toBe(160);
        expect(clamped.offsetX).toBe(-50);
        expect(clamped.offsetY).toBe(50);
        expect(clamped.opacity).toBe(20);
    });

    it('ships sensible defaults', () => {
        expect(DEFAULT_OVERLAY_TRANSFORM).toEqual({
            scale: 100,
            offsetX: 0,
            offsetY: 0,
            opacity: 90,
        });
    });
});
