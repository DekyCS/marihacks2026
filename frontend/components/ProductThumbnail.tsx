"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import * as THREE from "three";
import { fetchManualJSON, getComponentModelUrl, ManualJSON } from "@/lib/api";
import { Model, FitCamera } from "./AssemblyScene";

interface ProductThumbnailProps {
  manualId: string;
}

interface SceneComponent {
  modelUrl: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

function getAssembledComponents(manual: ManualJSON): SceneComponent[] {
  const lastStep = manual.steps[manual.steps.length - 1];
  if (!lastStep) return [];
  const componentCounts: Record<string, number> = {};
  return lastStep.components
    .map((compId) => {
      const component = manual.components.find((c) => c.id === compId);
      if (!component || !component.model_path) return null;
      const occ = componentCounts[compId] ?? 0;
      componentCounts[compId] = occ + 1;
      const indexedKey = `${compId}_${occ}`;
      const pos =
        lastStep.component_positions[indexedKey] ??
        lastStep.component_positions[compId];
      if (!pos) return null;
      return {
        modelUrl: getComponentModelUrl(component, manual.manual_id),
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: pos.rotation ?? { x: 0, y: 0, z: 0 },
        scale: pos.scale ?? { x: 1, y: 1, z: 1 },
      };
    })
    .filter(Boolean) as SceneComponent[];
}

function Placeholder() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: "var(--ink-mute)",
      }}
    >
      <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    </div>
  );
}

export default function ProductThumbnail({ manualId }: ProductThumbnailProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<THREE.Group>(null);
  const [visible, setVisible] = useState(false);
  const [components, setComponents] = useState<SceneComponent[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || components || error) return;
    let cancelled = false;
    fetchManualJSON(manualId)
      .then((manual) => {
        if (cancelled) return;
        const comps = getAssembledComponents(manual);
        if (comps.length === 0) setError(true);
        else setComponents(comps);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, manualId, components, error]);

  const sceneKey = useMemo(() => `${manualId}-${components?.length ?? 0}`, [manualId, components]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {!components || error ? (
        <Placeholder />
      ) : (
        <Canvas
          key={sceneKey}
          dpr={[1, 1.5]}
          camera={{ position: [1, 1, 1], fov: 55 }}
          gl={{
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.4,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[6, 8, 4]} intensity={0.9} />
            <directionalLight position={[-6, 3, -3]} intensity={0.4} />
            <Environment preset="studio" background={false} />

            <FitCamera reset={0} targetRef={contentRef} margin={1.35} />

            <group ref={contentRef}>
              <Center>
                {components.map((c, i) => (
                  <group
                    key={`${c.modelUrl}-${i}`}
                    position={[c.position.x, c.position.y, c.position.z]}
                    rotation={[
                      c.rotation.x * (Math.PI / 180),
                      c.rotation.y * (Math.PI / 180),
                      c.rotation.z * (Math.PI / 180),
                    ]}
                    scale={[c.scale.x, c.scale.y, c.scale.z]}
                    userData={{ isAssemblyComponent: true }}
                  >
                    <Model url={c.modelUrl} />
                  </group>
                ))}
              </Center>
            </group>
          </Suspense>

          <OrbitControls
            makeDefault
            autoRotate
            autoRotateSpeed={0.9}
            enableZoom={false}
            enablePan={false}
            enableRotate={false}
          />
        </Canvas>
      )}
    </div>
  );
}
