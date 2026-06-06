// Parse a submission issue body into a manifest, validate it, and write the
// manifest file. Reads the issue body from $ISSUE_BODY. Prefers a ```json block
// (from the in-app Submit button); otherwise reads the Issue Form fields.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { validateEquations } from "./validate.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const body = process.env.ISSUE_BODY ?? "";

function fromJsonBlock(src) {
  const m = /```json\s*([\s\S]*?)```/.exec(src);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function fromForm(src) {
  // GitHub Issue Forms render as "### Label\n\nvalue" sections.
  const get = (label) => {
    const re = new RegExp(`###\\s*${label}\\s*\\n+([\\s\\S]*?)(?:\\n###|$)`, "i");
    const v = re.exec(src)?.[1]?.trim();
    return v && v !== "_No response_" ? v : "";
  };
  const params = get("Parameters")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, rest] = l.split("=").map((s) => s.trim());
      const [def, min, max] = (rest ?? "").split(",").map((s) => parseFloat(s.trim()));
      const p = { name, default: Number.isFinite(def) ? def : 1 };
      if (Number.isFinite(min)) p.min = min;
      if (Number.isFinite(max)) p.max = max;
      return p;
    });
  const seeds = get("Seeds")
    .split("\n")
    .map((l) => l.split(",").map((s) => parseFloat(s.trim())))
    .filter((a) => a.length === 3 && a.every(Number.isFinite))
    .map((x) => ({ x }));
  return {
    schema: 1,
    name: get("Name") || "Untitled",
    author: get("Author (handle)") || "anon",
    description: get("Description"),
    equations: { dx: get("dx/dt"), dy: get("dy/dt"), dz: get("dz/dt") },
    params,
    seeds: seeds.length ? seeds : [{ x: [0.1, 0, 0] }],
    integrator: { dt: 0.01, steps: 12000, discardInitial: 1000, maxRadius: 1000 },
    license: (get("License") || "CC0").split(" ")[0],
  };
}

const def = fromJsonBlock(body) ?? fromForm(body);
if (!def || !def.equations?.dx) {
  console.error("Could not parse a manifest from the issue.");
  process.exit(1);
}

const slug = (def.name || "attractor").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const author = (def.author || "anon").toLowerCase().replace(/[^a-z0-9-]/g, "");
def.id = `${author}/${slug}`;
def.schema = 1;

const result = validateEquations(def.equations, (def.params ?? []).map((p) => p.name));
if (!result.ok) {
  console.error("Equation validation failed:", JSON.stringify(result.errors));
  process.exit(2);
}

const path = join(ROOT, "attractors", author, `${slug}.json`);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(def, null, 2) + "\n");
console.log(`Wrote ${path}`);
// Expose the path/id for the workflow.
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `path=attractors/${author}/${slug}.json\nid=${def.id}\n`, { flag: "a" });
}
