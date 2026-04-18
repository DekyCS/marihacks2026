import { Suspense, useMemo, useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Html, Bounds, useBounds, useProgress } from '@react-three/drei';
import * as THREE from 'three';

function Loader() {
  const [progress, setProgress] = useState(() => useProgress.getState().progress);
  useEffect(() => {
    return useProgress.subscribe((state) => setProgress(state.progress));
  }, []);
  return (
    <Html center>
      <div className="flex flex-col items-center whitespace-nowrap">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
        <span className="text-white font-mono text-sm">{Math.round(progress)}% loaded</span>
      </div>
    </Html>
  );
}

interface ModelProps {
  url: string;
  color?: string;
  highlight?: boolean;
}

function Model({ url, color, highlight }: ModelProps) {
  const { scene } = useGLTF(url);

  const styledScene = useMemo(() => {
    const cloned = scene.clone();

    // Deep clone materials to prevent color persistence across steps
    cloned.traverse((child: any) => {
      if (child.isMesh && child.material) {
        // Clone materials to avoid modifying shared references
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat: any) => mat.clone());
        } else {
          child.material = child.material.clone();
        }

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach((mat: any) => {
          if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            if (color && highlight) {
              // Only apply highlight color to moving parts
              mat.color.set(color);
              mat.emissive.set(color);
              mat.emissiveIntensity = 0.6;
            } else {
              // Reset to default for non-moving parts
              mat.emissive.set("#000000");
              mat.emissiveIntensity = 0;
            }
          }
        });
      }
    });

    return cloned;
  }, [scene, color, highlight]);

  return <primitive object={styledScene} />;
}

function FitOnReset({ reset }: { reset: number }) {
  const bounds = useBounds();
  const firstRun = useRef(true);
  useEffect(() => {
    if (!bounds) return;
    // Let models load for a tick, then fit
    const t = setTimeout(() => {
      bounds.refresh().clip().fit();
    }, firstRun.current ? 250 : 50);
    firstRun.current = false;
    return () => clearTimeout(t);
  }, [reset, bounds]);
  return null;
}

interface ComponentModelProps {
  url: string;
  isMoving: boolean;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  movement?: { position: { x: number; y: number; z: number } };
  resetTrigger: number;
}

function ComponentModel({ url, isMoving, position, rotation, scale, movement, resetTrigger }: ComponentModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const animationProgress = useRef(0);
  const pauseTimer = useRef(0);
  const isPaused = useRef(false);

  const startPosition = useMemo(() => {
    return new THREE.Vector3(position?.x || 0, position?.y || 0, position?.z || 0);
  }, [position]);

  const targetPosition = useMemo(() => {
    if (movement) {
      return new THREE.Vector3(
        startPosition.x + movement.position.x,
        startPosition.y + movement.position.y,
        startPosition.z + movement.position.z
      );
    }
    return startPosition.clone();
  }, [movement, startPosition]);

  useEffect(() => {
    if (movement && groupRef.current) {
      animationProgress.current = 0;
      pauseTimer.current = 0;
      isPaused.current = true;
      groupRef.current.position.copy(startPosition);
    }
  }, [resetTrigger, movement, startPosition]);

  useFrame((_state, delta) => {
    if (groupRef.current && movement) {
      if (isPaused.current) {
        pauseTimer.current += delta;
        if (pauseTimer.current >= 2) {
          pauseTimer.current = 0;
          isPaused.current = false;
          if (animationProgress.current >= 1) {
            animationProgress.current = 0;
            groupRef.current.position.copy(startPosition);
            isPaused.current = true;
            pauseTimer.current = 0;
          }
        }
        return;
      }

      animationProgress.current += delta * 0.5;

      if (animationProgress.current >= 1) {
        animationProgress.current = 1;
        isPaused.current = true;
        pauseTimer.current = 0;
      }

      const currentPos = new THREE.Vector3().lerpVectors(
        startPosition,
        targetPosition,
        animationProgress.current
      );

      groupRef.current.position.copy(currentPos);
    }
  });

  const initialPosition: [number, number, number] = [
    position?.x || 0,
    position?.y || 0,
    position?.z || 0
  ];

  const rotationArray: [number, number, number] = [
    (rotation?.x || 0) * (Math.PI / 180),
    (rotation?.y || 0) * (Math.PI / 180),
    (rotation?.z || 0) * (Math.PI / 180)
  ];

  const scaleArray: [number, number, number] = [
    scale?.x || 1,
    scale?.y || 1,
    scale?.z || 1
  ];

  return (
    <group
      ref={groupRef}
      position={initialPosition}
      rotation={rotationArray}
      scale={scaleArray}
    >
      <Model
        url={url}
        color={isMoving ? "#FF5733" : undefined}
        highlight={isMoving}
      />
    </group>
  );
}

interface AssemblySceneProps {
  components: Array<{
    modelUrl: string;
    isMoving: boolean;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    movement?: { position: { x: number; y: number; z: number } };
  }>;
  resetTrigger: number;
  zoomLevel?: number;
}

export default function AssemblyScene({ components, resetTrigger }: AssemblySceneProps) {
  // Preload all model URLs so useGLTF doesn't suspend during render
  useEffect(() => {
    components.forEach((comp) => useGLTF.preload(comp.modelUrl));
  }, [components]);

  return (
    <div className="w-full h-full bg-zinc-900">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [1, 1, 1], fov: 60 }}>
        <Suspense fallback={<Loader />}>
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight
            position={[-10, 5, -5]}
            intensity={0.5}
          />
          <pointLight position={[0, 10, 0]} intensity={0.3} />

          <Bounds fit clip observe margin={1.35}>
            <FitOnReset reset={resetTrigger} />
            <Stage intensity={0.5} adjustCamera={false} environment="studio">
              {components.map((comp, index) => (
                <ComponentModel
                  key={`${resetTrigger}-${index}`}
                  url={comp.modelUrl}
                  isMoving={comp.isMoving}
                  position={comp.position}
                  rotation={comp.rotation}
                  scale={comp.scale}
                  movement={comp.movement}
                  resetTrigger={resetTrigger}
                />
              ))}
            </Stage>
          </Bounds>
        </Suspense>

        <OrbitControls makeDefault enablePan />
      </Canvas>
    </div>
  );
}
