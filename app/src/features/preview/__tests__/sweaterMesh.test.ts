import { MeshStandardMaterial } from 'three';
import { expect, it } from 'vitest';
import type { GarmentPose } from '../garmentPose';
import { createSweaterMesh } from '../sweaterMesh';

const point = (x: number, y: number, z = 0) => ({ x, y, z, visibility: 1 });

it('keeps a volumetric torso and follows depth and elbow changes', () => {
    const material = new MeshStandardMaterial();
    const sweater = createSweaterMesh(material);
    const torso = sweater.group.children[0];
    const upperSleeve = sweater.group.children[1];

    const pose: GarmentPose = {
        shoulders: [point(0.3, -0.4), point(0.7, -0.4)],
        elbows: [point(0.25, -0.66), point(0.75, -0.65)],
        wrists: [point(0.28, -0.83), point(0.75, -0.83)],
        hips: [point(0.35, -0.92), point(0.65, -0.92)],
    };

    try {
        sweater.place(pose);
        const frontOrientation = torso.quaternion.clone();
        const initialSleeve = upperSleeve.position.clone();
        expect(torso.scale.z).toBeGreaterThan(0);
        expect(torso.position.x).toBeCloseTo(0.5);

        sweater.place({
            ...pose,
            shoulders: [point(0.3, -0.4, 0.11), point(0.7, -0.4, -0.06)],
            elbows: [point(0.20, -0.48, 0.2), pose.elbows[1]],
        });
        expect(torso.quaternion.angleTo(frontOrientation)).toBeGreaterThan(0.2);
        expect(upperSleeve.position.distanceTo(initialSleeve)).toBeGreaterThan(0.08);
    } finally {
        sweater.dispose();
        material.dispose();
    }
});
