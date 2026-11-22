import { useEffect, useRef } from 'react';
import {
    AmbientLight, DirectionalLight, DoubleSide, MeshStandardMaterial, OrthographicCamera,
    Scene, SRGBColorSpace, TextureLoader, WebGLRenderer,
} from 'three';
import type { GarmentPose } from './garmentPose';
import { createSweaterMesh } from './sweaterMesh';

interface Props {
    pose: GarmentPose | undefined;
    textureUrl: string;
    onUnavailable: () => void;
}

export default function Sweater3D({ pose, textureUrl, onUnavailable }: Props) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const render = useRef<(() => void) | null>(null);
    const poseRef = useRef(pose);

    useEffect(() => {
        const element = canvas.current;
        if (!element) return;

        let renderer: WebGLRenderer;
        try {
            renderer = new WebGLRenderer({ canvas: element, alpha: true, antialias: true });
        } catch {
            onUnavailable();
            return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        const scene = new Scene();
        const camera = new OrthographicCamera(0, 1, 0, -1.33, 0.01, 20);
        camera.position.z = 5;
        const material = new MeshStandardMaterial({ color: 0x27282b, roughness: 0.95, side: DoubleSide });
        const sweater = createSweaterMesh(material);
        scene.add(sweater.group, new AmbientLight(0xffffff, 1.4));
        const key = new DirectionalLight(0xfff5ec, 2.1);
        key.position.set(-2, 3, 4);
        scene.add(key);

        // Sample the central knit from the retailer flat-lay. The cut, sides and
        // back are reconstructed and use that same colour and fabric detail.
        let disposed = false;
        const texture = new TextureLoader().load(textureUrl, (loaded) => {
            if (disposed) return;
            loaded.colorSpace = SRGBColorSpace;
            loaded.repeat.set(0.22, 0.21);
            loaded.offset.set(0.39, 0.37);
            material.color.set(0xffffff);
            material.map = loaded;
            material.needsUpdate = true;
            render.current?.();
        });

        render.current = () => {
            const current = poseRef.current;
            sweater.group.visible = Boolean(current);
            if (current) sweater.place(current);
            renderer.render(scene, camera);
        };
        const resize = () => {
            const { width, height } = element.getBoundingClientRect();
            if (!width || !height) return;
            renderer.setSize(width, height, false);
            camera.bottom = -height / width;
            camera.updateProjectionMatrix();
            render.current?.();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        const handleContextLoss = (event: Event) => {
            event.preventDefault();
            onUnavailable();
        };
        element.addEventListener('webglcontextlost', handleContextLoss);
        resize();

        return () => {
            disposed = true;
            render.current = null;
            observer.disconnect();
            element.removeEventListener('webglcontextlost', handleContextLoss);
            texture.dispose();
            material.dispose();
            sweater.dispose();
            renderer.dispose();
        };
    }, [textureUrl, onUnavailable]);

    useEffect(() => {
        poseRef.current = pose;
        render.current?.();
    }, [pose]);

    return <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full"
        data-testid="garment-3d" aria-label="Reconstructed 3D sweater overlay" role="img" />;
}
