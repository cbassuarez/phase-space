import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { motion } from "framer-motion";
import { computeCameraPose } from "../../camera/controller";
import type { CameraContext, CameraPose, CameraProgram } from "../../camera/types";
import type {
  Background,
  CameraSpec,
  Palette,
  Trajectories,
  LineThickness,
  RenderStyle,
  Resolution,
  PhotonWeaveSettings,
  CausticsSettings,
} from "../../types";
import { useViewerState } from "../../state/viewerState";
import type { RendererStrategy } from "./renderers/base";
import { createRendererForStyle } from "./renderers";
import { computeVisualFeatures, type VisualFeatureFrame } from "../../visual/visualFeatures";
import { useModulation } from "../../state/modulationState";
import { getRenderQuality, getViewportBackgroundColor } from "../../visual/renderQuality";

interface CanvasPanelProps {
  ready: boolean;
  loading: boolean;
  error: string | null;
  trajectories: Trajectories;
  palette: Palette;
  background: Background;
  camera?: CameraSpec;
  cameraProgram?: CameraProgram | null;
  randomSeed?: number;
  autoSpin: boolean;
  animateHeadTail: boolean;
  showFullTrajectory: boolean;
  lineThickness: LineThickness;
  renderStyle: RenderStyle;
  resolution: Resolution;
  photonWeaveSettings: PhotonWeaveSettings;
  causticsSettings: CausticsSettings;
}

function PhaseScene({
  trajectories,
  palette,
  background,
  autoSpin,
  animateHeadTail,
  showFullTrajectory,
  cameraProgram,
  randomSeed,
  camera,
  lineThickness,
  renderStyle,
  resolution,
  photonWeaveSettings,
  causticsSettings,
}: Omit<CanvasPanelProps, "ready" | "loading" | "error">) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const lastPoseRef = useRef<CameraPose | null>(null);
  const strategyRef = useRef<RendererStrategy | null>(null);
  const countsRef = useRef<number[]>([]);
  const visualFrameRef = useRef<VisualFeatureFrame | null>(null);
  const tempRefs = useRef({
    target: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    position: new THREE.Vector3(),
    spherical: new THREE.Spherical(),
    bgBase: new THREE.Color(),
    bgAlt: new THREE.Color(),
  });
  const { scene, camera: threeCamera, gl } = useThree();
  const { setRenderStillHandler } = useViewerState();
  const { modEngine, audioFrameRef, modValuesRef } = useModulation();

  const quality = useMemo(() => getRenderQuality(resolution), [resolution]);

  const backgroundColor = useMemo(
    () => getViewportBackgroundColor(renderStyle, background),
    [background, renderStyle]
  );

  useEffect(() => {
    gl.setClearAlpha(1);
    gl.setClearColor(new THREE.Color(backgroundColor), 1);
    gl.autoClear = true;
  }, [gl, backgroundColor]);

  useEffect(() => {
    if (!cameraProgram) {
      lastPoseRef.current = null;
    }
  }, [cameraProgram]);

  const bounds = useMemo(() => {
    if (!trajectories.length) {
      return {
        bboxMin: [-10, -10, -10] as [number, number, number],
        bboxMax: [10, 10, 10] as [number, number, number],
        centroid: [0, 0, 0] as [number, number, number],
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    trajectories.forEach((traj) => {
      traj.forEach((p) => {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        minZ = Math.min(minZ, p[2]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
        maxZ = Math.max(maxZ, p[2]);
      });
    });

    const bboxMin: [number, number, number] = [minX, minY, minZ];
    const bboxMax: [number, number, number] = [maxX, maxY, maxZ];
    const centroid: [number, number, number] = [
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    ];
    return { bboxMin, bboxMax, centroid };
  }, [trajectories]);

  useEffect(() => {
    countsRef.current = trajectories.map((t) => t.length);
  }, [trajectories]);

  useEffect(() => {
    const ctx = { threeScene: scene, camera: threeCamera as THREE.PerspectiveCamera, renderer: gl as THREE.WebGLRenderer };
    const modValues = modValuesRef.current;
    const photonSettings =
      photonWeaveSettings ?? {
        brightness: 1,
        trailLength: 1,
        filamentDensity: "medium" as const,
        shimmer: true,
      };
    const causticsSettingsSafe =
      causticsSettings ?? {
        blurRadius: 0.35,
        intensity: 1,
        projectionAxis: "auto" as const,
        colorMode: "global" as const,
      };

    const photonBrightness = (modValues.photonWeaveBrightness ?? 1) * photonSettings.brightness;
    const causticsIntensity = (modValues.causticsIntensity ?? 1) * causticsSettingsSafe.intensity;

    const data = {
      trajectories,
      palette,
      lineThickness,
      background,
      paletteShift: modValues.paletteShift,
      emissiveBoost: modValues.emissiveBoost,
      ribbonWidth: modValues.ribbonWidth,
      cloudDensity: modValues.cloudDensity,
      backgroundBrightness: modValues.backgroundBrightness,
      quality,
      photonWeave: { ...photonSettings, brightness: photonBrightness },
      caustics: { ...causticsSettingsSafe, intensity: causticsIntensity },
    };
    if (!strategyRef.current || strategyRef.current.style !== renderStyle) {
      strategyRef.current?.dispose(ctx);
      const next = createRendererForStyle(renderStyle);
      strategyRef.current = next;
      next.init(ctx, data);
      setRenderStillHandler(null);
    } else {
      strategyRef.current.update(ctx, data);
    }

    return () => {
      strategyRef.current?.dispose(ctx);
      strategyRef.current = null;
      setRenderStillHandler(null);
    };
  }, [
    scene,
    threeCamera,
    gl,
    trajectories,
    palette,
    lineThickness,
    background,
    renderStyle,
    quality,
    photonWeaveSettings?.filamentDensity,
    causticsSettings?.projectionAxis,
    setRenderStillHandler,
  ]);

  useFrame((state, delta) => {
    const frameDelta = delta;
    const elapsedTime = state.clock.getElapsedTime();
    const { target, offset, position, spherical, bgBase, bgAlt } = tempRefs.current;
    const modValues = modValuesRef.current;
    target.set(0, 0, 0);
    position.set(0, 0, 0);
    if (cameraProgram) {
      if (autoSpin) {
        timeRef.current += frameDelta;
      }
      const ctx: CameraContext = {
        t: timeRef.current,
        dt: frameDelta,
        randomSeed: randomSeed ?? 42,
        bboxMin: bounds.bboxMin,
        bboxMax: bounds.bboxMax,
        centroid: bounds.centroid,
        trajectories: trajectories as [number, number, number][][],
        primaryTrajectoryIndex: 0,
      };
      const pose = computeCameraPose(cameraProgram, ctx, lastPoseRef.current);
      lastPoseRef.current = pose;
      position.set(pose.position[0], pose.position[1], pose.position[2]);
      target.set(pose.target[0], pose.target[1], pose.target[2]);
      state.camera.up.set(...pose.up);
    } else {
      const speed = 0.12;
      const baseTheta = camera?.theta ?? 0.8;
      const phi = camera?.phi ?? 0.9;
      const radius = THREE.MathUtils.clamp(camera?.r ?? 25, 6, 80);
      const angle = autoSpin ? (baseTheta + elapsedTime * speed) % (Math.PI * 2) : baseTheta;
      position.set(
        radius * Math.sin(phi) * Math.cos(angle),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(angle)
      );
      target.set(0, 0, 0);
    }

    offset.copy(position).sub(target);
    spherical.setFromVector3(offset);
    if (modValues.camera.r !== null) {
      spherical.radius = modValues.camera.r;
    }
    if (modValues.camera.theta !== null) {
      spherical.theta = modValues.camera.theta;
    }
    if (modValues.camera.phi !== null) {
      spherical.phi = modValues.camera.phi;
    }
    offset.setFromSpherical(spherical);
    position.copy(target).add(offset);
    state.camera.position.copy(position);
    state.camera.lookAt(target);

    const strategy = strategyRef.current;
    const cameraState = {
      theta: spherical.theta,
      phi: spherical.phi,
      r: spherical.radius,
      minR: 6,
      maxR: 80,
    };
    const visual = computeVisualFeatures({ camera: cameraState, trajectories }, visualFrameRef.current ?? undefined);
    visualFrameRef.current = visual;
    if (modEngine) {
      modEngine.step(audioFrameRef.current, visual);
    }

    if (strategy?.applyDynamic) {
      const photonSettings =
        photonWeaveSettings ?? {
          brightness: 1,
          trailLength: 1,
          filamentDensity: "medium" as const,
          shimmer: true,
        };
      const causticsSettingsSafe =
        causticsSettings ?? {
          blurRadius: 0.35,
          intensity: 1,
          projectionAxis: "auto" as const,
          colorMode: "global" as const,
        };

      const photonBrightness = (modValues.photonWeaveBrightness ?? 1) * photonSettings.brightness;
      const causticsIntensity = (modValues.causticsIntensity ?? 1) * causticsSettingsSafe.intensity;
      strategy.applyDynamic({
        trajectories,
        palette,
        lineThickness,
        background,
        paletteShift: modValues.paletteShift,
        emissiveBoost: modValues.emissiveBoost,
        ribbonWidth: modValues.ribbonWidth,
        cloudDensity: modValues.cloudDensity,
        backgroundBrightness: modValues.backgroundBrightness,
        quality,
        photonWeave: { ...photonSettings, brightness: photonBrightness },
        caustics: { ...causticsSettingsSafe, intensity: causticsIntensity },
      });
    }

    const baseColorHex = backgroundColor;
    bgBase.set(baseColorHex);
    bgAlt.set(background === "light" ? "#e3e6f0" : "#000000");
    const bgMix = bgBase.clone().lerp(bgAlt, modValues.backgroundBrightness);
    gl.setClearColor(bgMix, 1);

    if (strategy && strategy.updateDrawWindow) {
      countsRef.current.forEach((count, idx) => {
        if (showFullTrajectory) {
          strategy.updateDrawWindow(idx, 0, count);
          return;
        }
        const windowSize = Math.max(8, Math.floor(count * 0.35));
        if (animateHeadTail) {
          const head = Math.floor((elapsedTime * 24) % count);
          const start = Math.max(0, head - windowSize);
          let drawCount = windowSize;
          if (start + drawCount > count) {
            drawCount = count - start;
          }
          strategy.updateDrawWindow(idx, start, drawCount);
        } else {
          const start = Math.max(0, count - windowSize);
          strategy.updateDrawWindow(idx, start, windowSize);
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.6} />
      <pointLight position={[6, 12, 10]} intensity={0.4} />
      <color args={[backgroundColor]} attach="background" />
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
  cameraProgram,
  randomSeed,
  autoSpin,
  animateHeadTail,
  showFullTrajectory,
  lineThickness,
  renderStyle,
}: CanvasPanelProps) {
  const gradientClass =
    background === "light"
      ? "bg-[radial-gradient(circle_at_center,#fbfcff_0%,#e5ebff_70%)]"
      : "bg-gradient-to-br from-[#13162b] to-[#0b0d18]";

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
      className={`relative flex h-full min-h-[480px] w-full flex-1 min-w-0 rounded-[18px] border border-[color:var(--ps-border-subtle)] shadow-[var(--ps-shadow-subtle)] ${gradientClass}`}
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
              cameraProgram={cameraProgram}
              randomSeed={randomSeed}
              autoSpin={autoSpin}
              animateHeadTail={animateHeadTail}
              showFullTrajectory={showFullTrajectory}
              camera={camera}
              lineThickness={lineThickness}
              renderStyle={renderStyle}
            />
          </Suspense>
        </Canvas>
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/60 to-transparent"
        animate={{ opacity: background === "light" ? 0.3 : 0.15 }}
      />
    </motion.section>
  );
}

export default CanvasPanel;
