// Generates the macOS DMG install-window background:
//   src-tauri/dmg-background.png   1320×800 (2× the 660×400 DMG window)
//
// Styled to match the phase-space web app: light off-white surface, the
// `phase-space` wordmark, the tri-primary "signal" stripe (red/yellow/blue,
// same as the in-app version badge), and one restrained gradient arrow pointing
// from the app icon toward the Applications folder.
//
// Icons are placed by tauri.conf.json at window points (180,190) and (480,190);
// at 2× that puts their centres at (360,380) and (960,380) here.
//
// Requires `sharp`. Run:  npm i sharp && node scripts/make-dmg-background.mjs
import sharp from "sharp";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// DMG_OUT lets the renderer run from a scratch dir (where `sharp` is installed)
// while still writing into this repo. Defaults to the in-repo asset path.
const OUT = process.env.DMG_OUT
  ? resolve(process.env.DMG_OUT)
  : resolve(root, "src-tauri/dmg-background.png");

const svg = `
<svg width="1320" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- userSpaceOnUse so the gradient paints on the zero-height arrow line too -->
    <linearGradient id="tri" gradientUnits="userSpaceOnUse" x1="528" y1="380" x2="798" y2="380">
      <stop offset="0" stop-color="#FF1A1A"/>
      <stop offset="0.5" stop-color="#FFD600"/>
      <stop offset="1" stop-color="#0057FF"/>
    </linearGradient>
  </defs>

  <rect width="1320" height="800" fill="#f6f7fb"/>

  <!-- wordmark: "phase" light + "-space" bold, tracking-tight, ink (#141722) -->
  <text x="660" y="168" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="54" letter-spacing="-1" fill="#141722">
    <tspan font-weight="400">phase</tspan><tspan font-weight="700">-space</tspan>
  </text>

  <!-- tri-primary signal stripe -->
  <g>
    <rect x="600" y="196" width="40" height="6" rx="3" fill="#FF1A1A"/>
    <rect x="640" y="196" width="40" height="6" rx="3" fill="#FFD600"/>
    <rect x="680" y="196" width="40" height="6" rx="3" fill="#0057FF"/>
  </g>

  <!-- tagline (muted #8b90a5) -->
  <text x="660" y="252" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="23" letter-spacing="0.4" fill="#8b90a5">drag to Applications</text>

  <!-- one quiet arrow: app (360,380) → Applications (960,380) -->
  <g stroke="url(#tri)" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <line x1="528" y1="380" x2="792" y2="380"/>
    <polyline points="768,358 796,380 768,402"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT);
console.log(`wrote ${OUT}`);
