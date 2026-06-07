// Cross-platform build of the phasewasm crate into web/src/wasm.
// Runs from the `web/` directory (npm runs it with cwd = web). Replaces the old
// POSIX one-liner, which couldn't run under Windows `cmd` during the desktop
// release build.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const isWin = process.platform === "win32";
const exe = isWin ? ".exe" : "";

function resolveOnPath(cmd) {
  const probe = spawnSync(isWin ? "where" : "which", [cmd], { encoding: "utf8" });
  if (probe.status !== 0) return null;
  return probe.stdout.split(/\r?\n/).find(Boolean) || null;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

const localWasmPack = `../target/wasm-pack/bin/wasm-pack${exe}`;

let wasmPack = resolveOnPath("wasm-pack");
if (!wasmPack && existsSync(localWasmPack)) wasmPack = localWasmPack;
if (!wasmPack) {
  console.log("wasm-pack not found; installing locally with cargo…");
  const code = run("cargo", [
    "install", "wasm-pack", "--locked", "--version", "0.13.1",
    "--root", "../target/wasm-pack",
  ]);
  if (code !== 0) process.exit(code);
  wasmPack = localWasmPack;
}

process.exit(
  run(wasmPack, [
    "build", "../phasewasm",
    "--target", "web",
    "--out-dir", "../web/src/wasm",
    "--out-name", "phasewasm",
  ])
);
