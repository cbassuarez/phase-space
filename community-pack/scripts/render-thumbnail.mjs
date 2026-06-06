// Render a preview by loading the live app with the manifest encoded into a
// share hash and screenshotting the canvas — reuses the app's own renderer.
// Usage: node scripts/render-thumbnail.mjs attractors/<author>/<slug>.json
//
// NOTE: this works once the deployed app understands `#attractor=…` (i.e. the
// main phase-space site has shipped the custom-attractor feature). Until then
// it renders the default scene, so the step is best-effort (continue-on-error).
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const relPath = process.argv[2];
if (!relPath) {
  console.error("usage: render-thumbnail.mjs attractors/<author>/<slug>.json");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

const SITE = process.env.SITE_URL ?? "https://cbassuarez.github.io/phase-space/";
const hash = "#attractor=" + encodeURIComponent(Buffer.from(JSON.stringify(manifest)).toString("base64"));
const url = SITE.replace(/#.*$/, "") + hash;

const out = join(
  ROOT,
  "thumbnails",
  relPath.replace(/^attractors\//, "").replace(/\.json$/, ".jpg")
);
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 960 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("canvas", { timeout: 30000 });
  // Allow WASM init + integration + a few render frames to settle.
  await page.waitForTimeout(7000);
  const canvas = await page.$("canvas");
  await canvas.screenshot({ path: out, type: "jpeg", quality: 82 });
  console.log("wrote", out);
} finally {
  await browser.close();
}
