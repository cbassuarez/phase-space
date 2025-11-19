import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { motion } from "framer-motion";
import type { Background, CameraSpec, Palette, Trajectories, LineThickness } from "../../types";

interface CanvasPanelProps {
  ready: boolean;
  loading: boolean;
  error: string | null;
  trajectories: Trajectories;
  palette: Palette;
  background: Background;
  camera?: CameraSpec;
  autoSpin: boolean;
  animateHeadTail: boolean;
  showFullTrajectory: boolean;
  lineThickness: LineThickness;
}

function colorForTrajectory(idx: number, palette: Palette) {
  if (palette === "plasma") {
    const colors = ["#f72585", "#b5179e", "#7209b7", "#4361ee", "#4cc9f0"];
    return colors[idx % colors.length];
  }
  if (palette === "viridis") {
    const colors = ["#440154", "#482878", "#3e4989", "#26828e", "#35b779", "#90d743", "#fde725"];
    return colors[idx % colors.length];
  }
  if (palette === "rainbow") {
    const colors = ["#ff7a73", "#ffd66b", "#7cffc4", "#4f6fff", "#c084fc"];
    return colors[idx % colors.length];
  }
  const base = ["#4f6fff", "#ff7a73", "#ffd66b", "#6ee7b7", "#a78bfa"];
  return base[idx % base.length];
}

function PhaseScene({
  trajectories,
  palette,
  background,
  autoSpin,
  animateHeadTail,
  showFullTrajectory,
  camera,
  lineThickness,
}: Omit<CanvasPanelProps, "ready" | "loading" | "error">) {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.Line[]>([]);
  const cameraTheta = useRef(0.8);
  const cameraPhi = useRef(0.9);
  const cameraRadius = useRef(25);

  useEffect(() => {
    cameraTheta.current = camera?.theta ?? 0.8;
    cameraPhi.current = camera?.phi ?? 0.9;
    cameraRadius.current = camera?.r ?? 25;
  }, [camera]);

  const lineGeometries = useMemo(() => {
    const lineScale = lineThickness === "thin" ? 0.8 : lineThickness === "thick" ? 1.8 : 1.3;
    const pointSize = lineThickness === "thin" ? 0.9 : lineThickness === "thick" ? 2.4 : 1.6;
    return trajectories.map((traj, idx) => {
      const positions = new Float32Array(traj.length * 3);
      traj.forEach((p, i) => {
        positions[i * 3 + 0] = p[0];
        positions[i * 3 + 1] = p[1];
        positions[i * 3 + 2] = p[2];
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setDrawRange(0, positions.length / 3);
      const color = new THREE.Color(colorForTrajectory(idx, palette));
      const material = new THREE.LineBasicMaterial({
        color,
        linewidth: lineScale,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
      });
      const pointsMaterial = new THREE.PointsMaterial({
        color,
        size: pointSize,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      return { geometry, material, pointsMaterial };
    });
  }, [trajectories, palette, lineThickness]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const speed = 0.12;
    const baseTheta = cameraTheta.current;
    const phi = cameraPhi.current;
    const radius = THREE.MathUtils.clamp(cameraRadius.current, 6, 80);
    const angle = autoSpin ? (baseTheta + t * speed) % (Math.PI * 2) : baseTheta;
    state.camera.position.set(
      radius * Math.sin(phi) * Math.cos(angle),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(angle)
    );
    state.camera.lookAt(0, 0, 0);

    linesRef.current.forEach((line) => {
      const geometry = line?.geometry as THREE.BufferGeometry;
      const count = (geometry.getAttribute("position") as THREE.BufferAttribute).count;
      if (showFullTrajectory) {
        geometry.setDrawRange(0, count);
        return;
      }
      const windowSize = Math.max(8, Math.floor(count * 0.35));
      if (animateHeadTail) {
        const head = Math.floor((t * 24) % count);
        const start = Math.max(0, head - windowSize);
        let drawCount = windowSize;
        if (start + drawCount > count) {
          drawCount = count - start;
        }
        geometry.setDrawRange(start, drawCount);
      } else {
        const start = Math.max(0, count - windowSize);
        geometry.setDrawRange(start, windowSize);
      }
    });
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 12, 10]} intensity={0.4} />
      {lineGeometries.map(({ geometry, material, pointsMaterial }, idx) => (
        <group key={idx}>
          <line
            ref={(el) => {
              if (el) linesRef.current[idx] = el;
            }}
            geometry={geometry}
            material={material}
          />
          <points geometry={geometry} material={pointsMaterial} />
        </group>
      ))}
      <color args={[background === "dim" ? "#0e1019" : "#f8f9ff"]} attach="background" />
    </group>
  );
}

function CanvasPanel({
  ready,
  loading,
  error,
  trajectories,
  palette,
  background,
  camera,
  autoSpin,
  animateHeadTail,
  showFullTrajectory,
  lineThickness,
}: CanvasPanelProps) {
  const gradientClass =
    background === "dim"
      ? "bg-gradient-to-br from-[#13162b] to-[#0b0d18]"
      : "bg-[radial-gradient(circle_at_center,#fbfcff_0%,#e5ebff_70%)]";

  const initialCamera = useMemo(() => {
    const theta = camera?.theta ?? 0.8;
    const phi = camera?.phi ?? 0.9;
    const r = camera?.r ?? 25;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);
    return { position: [x, y, z] as [number, number, number] };
  }, [camera]);

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
      className={`relative flex h-full min-h-[480px] w-full flex-1 rounded-[18px] border border-[color:var(--ps-border-subtle)] shadow-[var(--ps-shadow-subtle)] ${gradientClass}`}
    >
      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-full border border-[color:var(--ps-border-subtle)] bg-white px-4 py-2 text-sm text-[color:var(--ps-text-soft)] shadow-soft">
            Loading engine…
          </div>
        </div>
      )}
      {loading && ready && (
        <div className="absolute inset-0 z-10 flex items-start justify-end p-3">
          <div className="rounded-full bg-white/80 px-3 py-1 text-xs text-[color:var(--ps-text-soft)] shadow-soft">
            Integrating…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-[14px] border border-red-200 bg-white px-4 py-3 text-sm text-red-600 shadow-soft">
            {error}
          </div>
        </div>
      )}
        <Canvas camera={{ position: initialCamera.position, fov: 45 }} dpr={[1, 2]}>
          <Suspense fallback={null}>
            <PhaseScene
              trajectories={trajectories}
              palette={palette}
              background={background}
              autoSpin={autoSpin}
              animateHeadTail={animateHeadTail}
              showFullTrajectory={showFullTrajectory}
              camera={camera}
              lineThickness={lineThickness}
            />
          </Suspense>
        </Canvas>
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/60 to-transparent"
        animate={{ opacity: background === "dim" ? 0.15 : 0.3 }}
      />
    </motion.section>
  );
}

export default CanvasPanel;
