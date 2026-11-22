import {
    BufferGeometry, Float32BufferAttribute, Group, Matrix4,
    Mesh, MeshStandardMaterial, Vector3,
} from 'three';
import type { GarmentPose, PosePoint } from './garmentPose';

const VERTICAL = new Vector3(0, 1, 0);
const SEGMENTS = 32;

function sweaterTorso() {
    // Cross sections in shoulder-span units, from the hem to the open crew neck.
    const rings = [
        [-1.05, 0.43, 0.205], [-0.96, 0.45, 0.22], [-0.62, 0.47, 0.24],
        [-0.27, 0.49, 0.255], [-0.06, 0.53, 0.235],
        [0.026, 0.47, 0.21], [0.094, 0.22, 0.149], [0.128, 0.19, 0.134],
    ];
    const vertices: number[] = [];
    const texcoords: number[] = [];
    const indices: number[] = [];
    rings.forEach(([y, width, depth], row) => {
        for (let i = 0; i <= SEGMENTS; i++) {
            const u = i / SEGMENTS;
            const theta = u * Math.PI * 2;
            vertices.push(Math.cos(theta) * width, y, Math.sin(theta) * depth);
            texcoords.push(u, row / (rings.length - 1));
            if (row > 0 && i > 0) {
                const at = row * (SEGMENTS + 1) + i;
                const below = at - SEGMENTS - 1;
                indices.push(below - 1, at - 1, at, below - 1, at, below);
            }
        }
    });
    const mesh = new BufferGeometry();
    mesh.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    mesh.setAttribute('uv', new Float32BufferAttribute(texcoords, 2));
    mesh.setIndex(indices);
    mesh.computeVertexNormals();
    return mesh;
}

const SLEEVE_SIDES = 18;
const SLEEVE_RADII = [0.153, 0.139, 0.133, 0.123, 0.112, 0.095, 0.068];

function sleeveGeometry() {
    const stride = SLEEVE_SIDES + 1;
    const verts = new Float32Array(SLEEVE_RADII.length * stride * 3);
    const coords: number[] = [];
    const indices: number[] = [];
    for (let ring = 0; ring < SLEEVE_RADII.length; ring++) {
        for (let i = 0; i <= SLEEVE_SIDES; i++) {
            coords.push(i / SLEEVE_SIDES, ring / (SLEEVE_RADII.length - 1));
            if (ring && i) {
                const n = ring * stride + i;
                indices.push(n - stride - 1, n - 1, n, n - stride - 1, n, n - stride);
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(verts, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(coords, 2));
    geometry.setIndex(indices);
    return geometry;
}

function bendSleeve(sleeve: Mesh, start: Vector3, elbow: Vector3, wrist: Vector3, span: number, forward: Vector3) {
    const centers = [
        start, start.clone().lerp(elbow, 0.45), start.clone().lerp(elbow, 0.87),
        elbow,
        elbow.clone().lerp(wrist, 0.15), elbow.clone().lerp(wrist, 0.60), wrist,
    ];
    const position = sleeve.geometry.getAttribute('position');
    sleeve.position.copy(elbow);
    for (let ring = 0; ring < centers.length; ring++) {
        const tangent = centers[Math.min(centers.length - 1, ring + 1)].clone()
            .sub(centers[Math.max(0, ring - 1)]).normalize();
        if (tangent.lengthSq() < 0.1) tangent.copy(VERTICAL);
        const reference = Math.abs(tangent.dot(forward)) < 0.94 ? forward :
            Math.abs(tangent.y) < 0.94 ? VERTICAL : new Vector3(1, 0, 0);
        const across = tangent.clone().cross(reference).normalize();
        const depth = across.clone().cross(tangent).normalize();
        const radius = span * SLEEVE_RADII[ring];
        const center = centers[ring].clone().sub(elbow);
        for (let i = 0; i <= SLEEVE_SIDES; i++) {
            const angle = i / SLEEVE_SIDES * 2 * Math.PI;
            const point = center.clone().addScaledVector(across, Math.cos(angle) * radius)
                .addScaledVector(depth, Math.sin(angle) * radius);
            position.setXYZ(ring * (SLEEVE_SIDES + 1) + i, point.x, point.y, point.z);
        }
    }
    position.needsUpdate = true;
    sleeve.geometry.computeVertexNormals();
    sleeve.geometry.computeBoundingSphere();
}

function vector(point: PosePoint) {
    return new Vector3(point.x, point.y, point.z);
}

export function createSweaterMesh(material: MeshStandardMaterial) {
    const group = new Group();
    const torsoGeometry = sweaterTorso();
    const torso = new Mesh(torsoGeometry, material);
    const arms = [new Mesh(sleeveGeometry(), material), new Mesh(sleeveGeometry(), material)];
    group.add(torso, ...arms);

    function place(pose: GarmentPose) {
        const shoulders = pose.shoulders.map(vector);
        const center = shoulders[0].clone().lerp(shoulders[1], 0.5);
        // Preserve left/right anatomy for the sleeves and use screen order for
        // the torso basis on the mirrored front-facing camera.
        const axis = shoulders[1].clone().sub(shoulders[0]);
        if (axis.x < 0) axis.negate();
        const width = Math.hypot(axis.x, axis.y);
        axis.z = Math.max(-width, Math.min(axis.z, width));
        const span = axis.length();
        axis.normalize();

        const [leftHip, rightHip] = pose.hips;
        const up = leftHip && rightHip
            ? center.clone().sub(vector(leftHip).lerp(vector(rightHip), 0.5))
            : VERTICAL.clone().multiplyScalar(span * 1.15);
        const height = Math.max(span * 0.85, Math.min(up.length(), span * 1.5));
        up.addScaledVector(axis, -up.dot(axis)).normalize();
        if (up.lengthSq() < 0.01 || up.y < 0.35) up.crossVectors(new Vector3(0, 0, 1), axis).normalize();
        const forward = axis.clone().cross(up).normalize();
        torso.position.copy(center).addScaledVector(forward, 0.052 * span);
        torso.scale.set(span, height, span);
        torso.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(axis, up, forward));

        arms.forEach((arm, i) => {
            const side = shoulders[i].x >= center.x ? 1 : -1;
            const start = shoulders[i].clone().addScaledVector(forward, span * 0.045);
            const elbow = pose.elbows[i] ? vector(pose.elbows[i]!) :
                start.clone().addScaledVector(up, -span * 0.58).addScaledVector(axis, side * span * 0.12);
            const wrist = pose.wrists[i] ? vector(pose.wrists[i]!) :
                elbow.clone().addScaledVector(up, -span * 0.54);
            // The cuff stops before the hand landmark.
            wrist.lerp(elbow, 0.08);
            start.addScaledVector(axis, -side * span * 0.09);
            bendSleeve(arm, start, elbow, wrist, span, forward);
        });
    }

    return {
        group,
        place,
        dispose() {
            torsoGeometry.dispose();
            for (const arm of arms) arm.geometry.dispose();
        },
    };
}
