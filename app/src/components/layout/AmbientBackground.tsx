/**
 * Static ambient mesh.
 *
 * Two fixed radial glows behind all content. Deliberately pure CSS with no
 * animation and no canvas — glass effects must not cost frame budget during the
 * card stagger, and a decorative layer should never be the thing that janks a
 * demo on a borrowed laptop.
 *
 * `aria-hidden` because it carries no meaning.
 */
export function AmbientBackground() {
    return (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-obsidian" />
            <div
                className="absolute -left-[10%] -top-[20%] h-[70vh] w-[70vw] rounded-full blur-[120px]"
                style={{ background: 'rgba(212, 175, 55, 0.08)' }}
            />
            <div
                className="absolute -right-[5%] top-[5%] h-[55vh] w-[55vw] rounded-full blur-[120px]"
                style={{ background: 'rgba(139, 92, 246, 0.07)' }}
            />
            {/* Faint vertical grain keeps the large dark areas from looking flat. */}
            <div
                className="absolute inset-0 opacity-[0.035]"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(0deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 3px)',
                }}
            />
        </div>
    );
}
