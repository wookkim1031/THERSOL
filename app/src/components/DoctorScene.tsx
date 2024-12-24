import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Model } from './doctor';
import type { Vector3Tuple } from 'three';

interface DoctorSceneProps {
    animationName?: string;
}

export function DoctorScene({ animationName = 'idle' }: DoctorSceneProps) {
    const cameraPosition: Vector3Tuple = [0, 0.5, 4.5]; 
    const lightPosition: Vector3Tuple = [5, 5, 5];
    const modelPosition: Vector3Tuple = [0, -1.5, 0]; 

    return (
        <div className="doctor-scene" style={{ height: '600px' }}> 
            <Canvas
                camera={{ position: cameraPosition, fov: 45 }} 
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={lightPosition} intensity={1} />
                <Model 
                    position={modelPosition} 
                    scale={1.2} 
                    animationName={animationName} 
                />
                <OrbitControls 
                    enableZoom={false} 
                    enablePan={false}
                />
            </Canvas>
        </div>
    );
}
