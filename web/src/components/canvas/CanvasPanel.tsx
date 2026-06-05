import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { motion } from "framer-motion";
import { computeCameraPose } from "../../camera/controller";
import { cameraInput } from "../../camera/cameraInput";
import { updateFaviconFromCanvas } from "../../utils/favicon";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Bloom only the blown-out HDR cores: a high luminance threshold lets the
// dark/dim background and mid-tones through untouched while the near-white
// attractor cores blaze. Strength/radius shape the halo.
const BLOOM_STRENGTH = 0.45;
const BLOOM_RADIUS = 0.55;
const BLOOM_THRESHOLD = 0.86;
import type { CameraContext, CameraPose, CameraProgram } from "../../camera/types";
import type {
  Background,
  CameraSpec,
  Palette,
  Trajectories,
  LineThickness,
  CellShape,
  MaterialStyle,
  RenderStyle,
  Resolution,
  PhotonWeaveSettings,
  CausticsSettings,
} from "../../types";
import type { CustomPaletteState } from "../../palettes";
import { useViewerState } from "../../state/viewerState";
import type { RendererStrategy } from "./renderers/base";
import { createRendererForStyle } from "./renderers";
import { normalizeTrajectories } from "./renderers/normalize";
import { computeDynamicScalars } from "./renderers/utils";
import { computeVisualFeatures, type VisualFeatureFrame } from "../../visual/visualFeatures";
import { useModulation } from "../../state/modulationState";
import { getRenderQuality, getViewportBackgroundColor } from "../../visual/renderQuality";

interface CanvasPanelProps {
  ready: boolean;
  loading: boolean;
  error: string | null;
  trajectories: Trajectories;
  palette: Palette;
  customPalette: CustomPaletteState;
  background: Background;
  camera?: CameraSpec;
  cameraProgram?: CameraProgram | null;
  randomSeed?: number;
  autoSpin: boolean;
  animateHeadTail: boolean;
  showFullTrajectory: boolean;
  lineThickness: LineThickness;
  cellShape: CellShape;
  cloudDensity: number;
  ribbonWidth: number;
  materialStyle: MaterialStyle;
  renderStyle: RenderStyle;
  resolution: Resolution;
  photonWeaveSettings: PhotonWeaveSettings;
  causticsSettings: CausticsSettings;
}

type PhaseSceneProps = Omit<CanvasPanelProps, "ready" | "loading" | "error"> & {
  setRenderStillHandler: (handler: (() => void) | null) => void;
};

function PhaseScene({
  trajectories,
  palette,
  customPalette,
  background,
  autoSpin,
  animateHeadTail,
  showFullTrajectory,
  cameraProgram,
  randomSeed,
  camera,
  lineThickness,
  cellShape,
  cloudDensity,
  ribbonWidth,
  materialStyle,
  renderStyle,
  resolution,
  photonWeaveSettings,
  causticsSettings,
  setRenderStillHandler,
}: PhaseSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const lastPoseRef = useRef<CameraPose | null>(null);
  const strategyRef = useRef<RendererStrategy | null>(null);
  const countsRef = useRef<number[]>([]);
  const visualFrameRef = useRef<VisualFeatureFrame | null>(null);
  const lastFaviconRef = useRef(0);
  const tempRefs = useRef({
    target: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    position: new THREE.Vector3(),
    spherical: new THREE.Spherical(),
    bgBase: new THREE.Color(),
    bgAlt: new THREE.Color(),
  });
  const { scene, camera: threeCamera, gl } = useThree();
  const viewSize = useThree((s) => s.size);
  const { modEngine, audioFrameRef, modValuesRef } = useModulation();

  // Post-processing: an UnrealBloom pass over the whole scene. Taking a render
  // priority hands the render loop to us (R3F stops auto-rendering); we run the
  // composer for dark/dim themes and a plain render for light (where bloom on
  // the bright background would be wrong).
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, threeCamera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(viewSize.width || 1, viewSize.height || 1),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD
    );
    bloomRef.current = bloom;
    c.addPass(bloom);
    return c;
    // viewSize handled via setSize below so the composer isn't rebuilt on resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, threeCamera]);

  useEffect(() => {
    composer.setSize(viewSize.width, viewSize.height);
  }, [composer, viewSize.width, viewSize.height]);

  useEffect(() => () => composer.dispose(), [composer]);

  // "Save PNG": capture synchronously inside the click gesture. (A deferred
  // flag-then-render-next-frame approach leaked downloads — the flag survived
  // tab-blur/bfcache and fired on refocus/reload.) We render one transparent
  // frame straight to the canvas, with the render-target/clear state the
  // composer leaves behind made explicit so the export isn't blank.
  useEffect(() => {
    const handler = () => {
      const canvas = gl.domElement as HTMLCanvasElement;
      const prevBg = scene.background;
      const prevClear = gl.getClearColor(new THREE.Color());
      const prevAlpha = gl.getClearAlpha();
      const prevAuto = gl.autoClear;
      const prevTarget = gl.getRenderTarget();
      scene.background = null;
      gl.autoClear = true;
      gl.setRenderTarget(null);
      gl.setClearColor(0x000000, 0);
      gl.clear();
      gl.render(scene, threeCamera);
      const url = canvas.toDataURL("image/png");
      scene.background = prevBg;
      gl.setClearColor(prevClear, prevAlpha);
      gl.autoClear = prevAuto;
      gl.setRenderTarget(prevTarget);
      const a = document.createElement("a");
      a.href = url;
      a.download = `phase-space-${Date.now()}.png`;
      a.click();
    };
    // NB: wrap in a function — `setRenderStillHandler` is a useState setter, so
    // passing the handler directly would make React treat it as a functional
    // updater and *call* it (capturing/downloading on mount, and storing
    // `undefined` so the button later does nothing).
    setRenderStillHandler(() => handler);
    return () => setRenderStillHandler(null);
  }, [gl, scene, threeCamera, setRenderStillHandler]);

  const quality = useMemo(() => getRenderQuality(resolution), [resolution]);
  
  const normalized = useMemo(() => normalizeTrajectories(trajectories), [trajectories]);
  const normalizedTrajectories = normalized.trajectories;
  const dynamicScalars = useMemo(
    () => computeDynamicScalars(normalizedTrajectories),
    [normalizedTrajectories]
  );
  
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
    if (!normalizedTrajectories.length) {
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

    normalizedTrajectories.forEach((traj) => {
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
  }, [normalizedTrajectories]);

  // Render-loop takeover (priority 1). Bloom (via composer) only for dark/dim
  // line/cell/ribbon/cloud styles; photon-weave is already an additive glow and
  // its thin moving filaments make the bloom threshold flicker, so it renders
  // plain. Light renders plain (bloom would catch the bright background).
  useFrame(() => {
    const useBloom = background !== "light" && renderStyle !== "photon-weave";
    if (useBloom) {
      const bloom = bloomRef.current;
      if (bloom) {
        const c = bounds.centroid;
        const dist = Math.hypot(
          threeCamera.position.x - c[0],
          threeCamera.position.y - c[1],
          threeCamera.position.z - c[2]
        );
        const span = bounds.bboxMax.map((v, i) => v - bounds.bboxMin[i]);
        const radius = Math.max(1e-3, Math.hypot(span[0], span[1], span[2]) * 0.35);
        const fit = radius * 2.6; // ~distance where the attractor fills the view
        const scale = THREE.MathUtils.clamp(fit / Math.max(dist, 1e-3), 0.12, 1);
        bloom.strength = BLOOM_STRENGTH * scale;
      }
      // Our shaders output final display-referred colour (toneMapped:false).
      // The composer's final blit would otherwise re-encode to sRGB, washing
      // the colour vs the plain (light) path — render it linear to match.
      const prevColorSpace = gl.outputColorSpace;
      gl.outputColorSpace = THREE.LinearSRGBColorSpace;
      composer.render();
      gl.outputColorSpace = prevColorSpace;
    } else {
      gl.render(scene, threeCamera);
    }

    // Keep the browser-tab favicon in sync with the live attractor (throttled).
    const t = performance.now();
    if (t - lastFaviconRef.current > 2000) {
      lastFaviconRef.current = t;
      updateFaviconFromCanvas(gl.domElement as HTMLCanvasElement);
    }
  }, 1);

  useEffect(() => {
   countsRef.current = normalizedTrajectories.map((t) => t.length);
  }, [normalizedTrajectories]);

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
    const photonTrailLength = (modValues.photonWeaveTrail ?? 1) * photonSettings.trailLength;
    const causticsIntensity = (modValues.causticsIntensity ?? 1) * causticsSettingsSafe.intensity;
    const causticsBlur = modValues.causticsBlur ?? causticsSettingsSafe.blurRadius;

    const data = {
      trajectories: normalizedTrajectories,
      normalized,
      dynamics: dynamicScalars,
      palette,
      customPalette,
      lineThickness,
      cellShape,
      materialStyle,
      background,
      paletteShift: modValues.paletteShift,
      renderEnergy: modValues.renderEnergy,
      renderPulse: modValues.renderPulse,
      lineWidthScale: modValues.lineWidthScale,
      cellSizeScale: modValues.cellSizeScale,
      emissiveBoost: modValues.emissiveBoost,
      ribbonWidth: modValues.ribbonWidth ?? ribbonWidth,
      ribbonGlow: modValues.ribbonGlow,
      cloudDensity: modValues.cloudDensity ?? cloudDensity,
      backgroundBrightness: modValues.backgroundBrightness,
      quality,
      photonWeave: { ...photonSettings, brightness: photonBrightness, trailLength: photonTrailLength },
      caustics: { ...causticsSettingsSafe, intensity: causticsIntensity, blurRadius: causticsBlur },
    };
    if (!strategyRef.current || strategyRef.current.style !== renderStyle) {
      strategyRef.current?.dispose(ctx);
      const next = createRendererForStyle(renderStyle);
      strategyRef.current = next;
      next.init(ctx, data);
    } else {
      strategyRef.current.update(ctx, data);
    }

    return () => {
      strategyRef.current?.dispose(ctx);
      strategyRef.current = null;
    };
  }, [
    scene,
    threeCamera,
    gl,
    trajectories,
    normalized,
    normalizedTrajectories,
    dynamicScalars,
    palette,
    customPalette,
    lineThickness,
    materialStyle,
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
      const viewSize = state.size;
      const aspect = viewSize && viewSize.height > 0
        ? viewSize.width / viewSize.height
        : 16 / 9;
      const ctx: CameraContext = {
        t: timeRef.current,
        dt: frameDelta,
        randomSeed: randomSeed ?? 42,
        aspect,
        bboxMin: bounds.bboxMin,
        bboxMax: bounds.bboxMax,
        centroid: bounds.centroid,
        trajectories: normalizedTrajectories as [number, number, number][][],
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
    if (modValues.camera.pulse > 0) {
      spherical.radius *= 1 + modValues.camera.pulse * 0.32;
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, 4, 120);
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
    const visual = computeVisualFeatures(
      { camera: cameraState, trajectories: normalizedTrajectories },
      visualFrameRef.current ?? undefined
    );
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
      const photonTrailLength = (modValues.photonWeaveTrail ?? 1) * photonSettings.trailLength;
      const causticsIntensity = (modValues.causticsIntensity ?? 1) * causticsSettingsSafe.intensity;
      const causticsBlur = modValues.causticsBlur ?? causticsSettingsSafe.blurRadius;
      strategy.applyDynamic({
        trajectories: normalizedTrajectories,
        normalized,
        dynamics: dynamicScalars,
        palette,
        lineThickness,
        cellShape,
        materialStyle,
        background,
        customPalette,
        paletteShift: modValues.paletteShift,
        renderEnergy: modValues.renderEnergy,
        renderPulse: modValues.renderPulse,
        lineWidthScale: modValues.lineWidthScale,
        cellSizeScale: modValues.cellSizeScale,
        emissiveBoost: modValues.emissiveBoost,
        ribbonWidth: modValues.ribbonWidth ?? ribbonWidth,
        ribbonGlow: modValues.ribbonGlow,
        cloudDensity: modValues.cloudDensity ?? cloudDensity,
        backgroundBrightness: modValues.backgroundBrightness,
        quality,
        photonWeave: { ...photonSettings, brightness: photonBrightness, trailLength: photonTrailLength },
        caustics: { ...causticsSettingsSafe, intensity: causticsIntensity, blurRadius: causticsBlur },
      });
    }

    const baseColorHex = backgroundColor;
    bgBase.set(baseColorHex);
    bgAlt.set(background === "light" ? "#e3e6f0" : "#000000");
    const bgMix = bgBase.clone().lerp(bgAlt, modValues.backgroundBrightness);
    gl.setClearColor(bgMix, 1);

    if (strategy?.updateDrawWindow) {
      countsRef.current.forEach((count, idx) => {
        if (showFullTrajectory) {
          strategy.updateDrawWindow?.(idx, 0, count);
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
          strategy.updateDrawWindow?.(idx, start, drawCount);
        } else {
          const start = Math.max(0, count - windowSize);
          strategy.updateDrawWindow?.(idx, start, windowSize);
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
  customPalette,
  background,
  camera,
  cameraProgram,
  randomSeed,
  autoSpin,
  animateHeadTail,
  showFullTrajectory,
  lineThickness,
  cellShape,
  cloudDensity,
  ribbonWidth,
  materialStyle,
  renderStyle,
  resolution,
  photonWeaveSettings,
  causticsSettings,
}: CanvasPanelProps) {
  const { setRenderStillHandler } = useViewerState();
  const gradientClass =
    background === "light"
      ? "bg-[radial-gradient(circle_at_center,#fbfcff_0%,#e5ebff_70%)]"
      : background === "dim"
        ? "bg-black"
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

  // Pointer/wheel → camera grab. Works in every mode (the controller decides
  // whether to latch persistently or gradually hand back to the program).
  const grabbingRef = useRef(false);
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    grabbingRef.current = true;
    cameraInput.beginDrag();
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!grabbingRef.current) return;
    const height = e.currentTarget.clientHeight || window.innerHeight;
    cameraInput.dragBy(e.movementX, e.movementY, height);
  };
  const endGrab = (e: React.PointerEvent<HTMLElement>) => {
    if (!grabbingRef.current) return;
    grabbingRef.current = false;
    cameraInput.endDrag();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    cameraInput.zoomBy(e.deltaY);
  };

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endGrab}
      onPointerCancel={endGrab}
      onWheel={handleWheel}
      className={`relative flex h-full w-full flex-1 min-w-0 min-h-0 cursor-grab touch-none overflow-hidden rounded-[18px] border border-[color:var(--ps-border-subtle)] shadow-[var(--ps-shadow-subtle)] active:cursor-grabbing ${gradientClass}`}
    >
      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-full border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] px-4 py-2 text-sm text-[color:var(--ps-text-soft)] shadow-soft">
            Loading engine…
          </div>
        </div>
      )}
      {loading && ready && (
        <div className="absolute inset-0 z-10 flex items-start justify-end p-3">
          <div className="rounded-full border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] px-3 py-1 text-xs text-[color:var(--ps-text-soft)] shadow-soft">
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
        <Canvas
          camera={{ position: initialCamera.position, fov: 45 }}
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <PhaseScene
              trajectories={trajectories}
              palette={palette}
              customPalette={customPalette}
              background={background}
              cameraProgram={cameraProgram}
              randomSeed={randomSeed}
              autoSpin={autoSpin}
              animateHeadTail={animateHeadTail}
              showFullTrajectory={showFullTrajectory}
              camera={camera}
              lineThickness={lineThickness}
              cellShape={cellShape}
              cloudDensity={cloudDensity}
              ribbonWidth={ribbonWidth}
              materialStyle={materialStyle}
              renderStyle={renderStyle}
              resolution={resolution}
              photonWeaveSettings={photonWeaveSettings}
              causticsSettings={causticsSettings}
              setRenderStillHandler={setRenderStillHandler}
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
