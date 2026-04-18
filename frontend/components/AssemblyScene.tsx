import { Suspense, useMemo, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  Center,
  Environment,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";

function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center whitespace-nowrap">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Html>
  );
}

interface ModelProps {
  url: string;
  color?: string;
  highlight?: boolean;
}

function toStandard(mat: any): THREE.MeshStandardMaterial {
  if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
    return mat as THREE.MeshStandardMaterial;
  }
  // GLTFs shipped as KHR_materials_unlit become MeshBasicMaterial and
  // ignore every light. Convert Basic/Lambert/Phong → Standard so lights land.
  const std = new THREE.MeshStandardMaterial();
  if (mat.color) std.color.copy(mat.color);
  if (mat.map) std.map = mat.map;
  if (mat.normalMap) std.normalMap = mat.normalMap;
  if (mat.alphaMap) std.alphaMap = mat.alphaMap;
  if (typeof mat.opacity === "number") std.opacity = mat.opacity;
  if (typeof mat.transparent === "boolean") std.transparent = mat.transparent;
  if (typeof mat.side === "number") std.side = mat.side;
  std.metalness = 0.2;
  std.roughness = 0.55;
  std.name = mat.name || "converted";
  return std;
}

function Model({ url, color, highlight }: ModelProps) {
  const { scene } = useGLTF(url);

  const styledScene = useMemo(() => {
    const cloned = scene.clone();

    cloned.traverse((child: any) => {
      if (!child.isMesh || !child.material) return;

      const replace = (mat: any): THREE.MeshStandardMaterial => {
        const std = toStandard(mat).clone();
        std.envMapIntensity = 2.5;
        if (typeof std.roughness === "number") {
          std.roughness = Math.min(std.roughness, 0.55);
        }
        if (color && highlight) {
          std.color.set(color);
          std.emissive.set(color);
          std.emissiveIntensity = 0.6;
        } else {
          std.emissive.set("#000000");
          std.emissiveIntensity = 0;
        }
        std.needsUpdate = true;
        return std;
      };

      child.material = Array.isArray(child.material)
        ? child.material.map(replace)
        : replace(child.material);

      child.castShadow = true;
      child.receiveShadow = true;
    });

    return cloned;
  }, [scene, color, highlight]);

  return <primitive object={styledScene} />;
}

function FitCamera({
  reset,
  targetRef,
  margin = 1.15,
}: {
  reset: number;
  targetRef: React.RefObject<THREE.Group | null>;
  margin?: number;
}) {
  const { camera, controls, gl } = useThree();

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const maxTries = 40;

    const tryFit = (): boolean => {
      const target = targetRef.current;
      if (!target) return false;

      target.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(target);
      if (
        box.isEmpty() ||
        !isFinite(box.min.x) ||
        !isFinite(box.max.x) ||
        box.max.x - box.min.x < 1e-6
      ) {
        return false;
      }

      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const pCam = camera as THREE.PerspectiveCamera;
      const canvas = gl.domElement;
      const aspect =
        canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1;
      const fov = pCam.fov * (Math.PI / 180);

      // Fit largest visible extent considering aspect ratio.
      const fitHeightDistance = size.y / (2 * Math.tan(fov / 2));
      const fitWidthDistance = size.x / (2 * Math.tan(fov / 2) * aspect);
      const distance =
        Math.max(fitHeightDistance, fitWidthDistance) * margin +
        size.z / 2;

      const dir = new THREE.Vector3(1, 0.9, 1).normalize();
      pCam.position.copy(center).addScaledVector(dir, distance);
      pCam.near = Math.max(0.01, distance / 100);
      pCam.far = distance * 100;
      pCam.updateProjectionMatrix();
      pCam.lookAt(center);

      if (controls) {
        const c = controls as unknown as {
          target: THREE.Vector3;
          update: () => void;
        };
        c.target.copy(center);
        c.update();
      }
      return true;
    };

    const interval = setInterval(() => {
      if (cancelled) return;
      tries++;
      if (tryFit() || tries >= maxTries) clearInterval(interval);
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [reset, camera, controls, gl, targetRef, margin]);

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

function ComponentModel({
  url,
  isMoving,
  position,
  rotation,
  scale,
  movement,
  resetTrigger,
}: ComponentModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const animationProgress = useRef(0);
  const pauseTimer = useRef(0);
  const isPaused = useRef(false);

  const startPosition = useMemo(() => {
    return new THREE.Vector3(
      position?.x || 0,
      position?.y || 0,
      position?.z || 0,
    );
  }, [position]);

  const targetPosition = useMemo(() => {
    if (movement) {
      return new THREE.Vector3(
        startPosition.x + movement.position.x,
        startPosition.y + movement.position.y,
        startPosition.z + movement.position.z,
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
        animationProgress.current,
      );

      groupRef.current.position.copy(currentPos);
    }
  });

  const initialPosition: [number, number, number] = [
    position?.x || 0,
    position?.y || 0,
    position?.z || 0,
  ];

  const rotationArray: [number, number, number] = [
    (rotation?.x || 0) * (Math.PI / 180),
    (rotation?.y || 0) * (Math.PI / 180),
    (rotation?.z || 0) * (Math.PI / 180),
  ];

  const scaleArray: [number, number, number] = [
    scale?.x || 1,
    scale?.y || 1,
    scale?.z || 1,
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

export default function AssemblyScene({
  components,
  resetTrigger,
}: AssemblySceneProps) {
  // Preload all model URLs so useGLTF doesn't suspend during render
  useEffect(() => {
    components.forEach((comp) => useGLTF.preload(comp.modelUrl));
  }, [components]);

  const contentRef = useRef<THREE.Group>(null);

  return (
    <div className="w-full h-full bg-zinc-900">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [1, 1, 1], fov: 60 }}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.6,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <Suspense fallback={<Loader />}>
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-10, 5, -5]} intensity={0.5} />
          <pointLight position={[0, 10, 0]} intensity={0.3} />

          <Environment preset="studio" background={false} />

          <FitCamera reset={resetTrigger} targetRef={contentRef} margin={1.6} />

          <group ref={contentRef}>
            <Center>
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
            </Center>
          </group>

          <ContactShadows
            position={[0, -1, 0]}
            opacity={0.35}
            scale={10}
            blur={2}
            far={4}
          />
        </Suspense>

        <OrbitControls makeDefault enablePan zoomSpeed={0.35} />
      </Canvas>
    </div>
  );
}
