// web/src/main.ts
import { loadWasmEngine } from "./phaseClient";
import * as THREE from "three";

type Trajectories = number[][][]; // [trajectory][point][xyz]

async function main() {
  const debugEl = document.getElementById("debug");
  const canvasRoot = document.getElementById("canvas-root");

  if (!canvasRoot) {
    console.error("Missing #canvas-root");
    return;
  }

  try {
    const { engine } = await loadWasmEngine();

    const sceneJson = engine.default_lorenz_scene();
    const trajectories = engine.integrate_scene(sceneJson) as Trajectories;

    // Sidebar debug text (what you're seeing now)
    if (debugEl) {
      debugEl.textContent = [
        "Default Lorenz scene:",
        sceneJson,
        "",
        "Trajectories shape:",
        Array.isArray(trajectories)
          ? `outer length = ${trajectories.length}`
          : "not an array",
      ].join("\n");
    }

    // Parse view info if we want camera hints
    const sceneSpec = JSON.parse(sceneJson);

    initThreeRenderer(canvasRoot, trajectories, sceneSpec);
  } catch (err) {
    console.error(err);
    if (debugEl) {
      debugEl.textContent = `Error: ${String(err)}`;
    }
  }
}

function initThreeRenderer(
  container: HTMLElement,
  trajectories: Trajectories,
  sceneSpec: any
) {
  const { clientWidth: width, clientHeight: height } = container;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510);

  // Camera: use sceneSpec.view.camera if available, otherwise fallback
  const cam = sceneSpec?.view?.camera ?? { theta: 0.8, phi: 0.9, r: 25.0 };
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

  // Spherical → Cartesian
  const theta = cam.theta ?? 0.8;
  const phi = cam.phi ?? 0.9;
  const r = cam.r ?? 25.0;

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);

  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  container.innerHTML = ""; // clear any previous canvas
  container.appendChild(renderer.domElement);

  // Simple soft ambient light (for future objects; lines don't need it but harmless)
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // Build line geometry for each trajectory
  trajectories.forEach((traj, idx) => {
    if (!Array.isArray(traj) || traj.length === 0) return;

    const positions = new Float32Array(traj.length * 3);
    for (let i = 0; i < traj.length; i++) {
      const p = traj[i];
      positions[i * 3 + 0] = p[0];
      positions[i * 3 + 1] = p[1];
      positions[i * 3 + 2] = p[2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const color = colorForIndex(idx);

    const material = new THREE.LineBasicMaterial({
      color,
      linewidth: 1,
      transparent: true,
      opacity: 0.9,
    });

    const line = new THREE.Line(geometry, material);
    scene.add(line);
  });

  // Mild rotation just to make it feel alive
  function animate() {
    requestAnimationFrame(animate);
    scene.rotation.y += 0.0015;
    renderer.render(scene, camera);
  }
  animate();

  // Handle resize
  window.addEventListener("resize", () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

function colorForIndex(idx: number): number {
  // Simple palette cycle
  const palette = [0xf07850, 0x50c8f0, 0xc8a0ff, 0xffe678, 0x7cffc4];
  return palette[idx % palette.length];
}

main();
