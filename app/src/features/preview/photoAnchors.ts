/** Inner front collar point and shoulder span in the 3:4, bottom-aligned overlay. */
export interface PhotoAnchor {
    x: number;
    y: number;
    shoulderSpan: number;
}

const ANCHORS: Readonly<Record<string, PhotoAnchor>> = {
    '/catalog/everlane-cashmere-slim-crew-navy-flat.png': { x: 0.494, y: 0.294, shoulderSpan: 0.42 },
    '/catalog/p-garden-jersey-flat.jpg': { x: 0.498, y: 0.2688, shoulderSpan: 0.45 },
    '/catalog/m-wedding-tee.jpg': { x: 0.507, y: 0.317, shoulderSpan: 0.49 },
    '/catalog/m-soft-crew-flat.jpg': { x: 0.489, y: 0.316, shoulderSpan: 0.455 },
};

export function photoAnchor(asset: string | null): PhotoAnchor | undefined {
    return asset ? ANCHORS[asset] : undefined;
}
