import type { SceneSpec } from "../types";

const rustRenderStyleMap: Record<string, string> = {
  line: "path-trace",
  cells: "volumetric-cloud",
  "photon-weave": "neon-filaments",
  caustics: "crt-scope",
  ribbon: "ribbon",
  "volumetric-cloud": "volumetric-cloud",
};

export function sceneForRust(scene: SceneSpec): Record<string, unknown> {
  const rustScene = JSON.parse(JSON.stringify(scene)) as Record<string, unknown>;
  delete rustScene.camera;
  const view = rustScene.view as Record<string, unknown> | undefined;
  if (view) {
    const renderStyle = view.render_style;
    if (renderStyle) {
      view.render_style = rustRenderStyleMap[String(renderStyle)];
    }
    if (view.background === "dim") {
      view.background = "dark";
    }
  }
  return rustScene;
}
