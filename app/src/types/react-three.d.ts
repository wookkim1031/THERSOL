import { Object3D, Light } from 'three';

declare module '@react-three/fiber' {
    export interface ThreeElements {
        ambientLight: JSX.IntrinsicElements['mesh'] & {
            intensity?: number;
        };
        directionalLight: JSX.IntrinsicElements['mesh'] & {
            intensity?: number;
            position?: [number, number, number];
        };
        group: JSX.IntrinsicElements['div'] & {
            position?: [number, number, number];
            scale?: number | [number, number, number];
            ref?: React.RefObject<Object3D>;
        };
    }

    export function Canvas(props: {
        children: React.ReactNode;
        camera?: {
            position?: [number, number, number];
            fov?: number;
        };
        style?: React.CSSProperties;
    }): JSX.Element;
}

declare module '@react-three/drei' {
    export function OrbitControls(props: {
        enableZoom?: boolean;
        enablePan?: boolean;
    }): JSX.Element;
}
