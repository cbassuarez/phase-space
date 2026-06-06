// Regenerate index.json from every attractors/**/<id>.json manifest.
// Run on merge to main (see .github/workflows/index.yml).
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIR = join(ROOT, "attractors");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

const list = walk(DIR)
  .map((f) => JSON.parse(readFileSync(f, "utf8")))
  .filter((d) => d && d.equations && d.equations.dx)
  .sort((a, b) => String(a.name).localeCompare(String(b.name)));

writeFileSync(join(ROOT, "index.json"), JSON.stringify(list, null, 2) + "\n");
console.log(`index.json: ${list.length} attractor(s)`);
