# phase-space-attractors

Community pack of **user-defined attractors** for [phase-space](https://github.com/cbassuarez/phase-space).

An attractor here is **pure data** — three derivative equations (math, not code) plus
parameters and seeds. The app fetches this repo's `index.json` at runtime (via jsDelivr),
so approved attractors appear without redeploying the app.

> Push the contents of this folder to a new repo named **`phase-space-attractors`** under
> your account, enable Actions, and you're live. The app already points at
> `cbassuarez/phase-space-attractors@main/index.json`.

## Manifest format (`attractors/<author>/<id>.json`)

```jsonc
{
  "schema": 1,
  "id": "seb/halvorsen",
  "name": "Halvorsen",
  "author": "seb",
  "description": "Cyclically symmetric, quadratic.",
  "equations": {
    "dx": "-a*x - 4*y - 4*z - y^2",
    "dy": "-a*y - 4*z - 4*x - z^2",
    "dz": "-a*z - 4*x - 4*y - x^2"
  },
  "params": [{ "name": "a", "default": 1.4, "min": 0.5, "max": 3 }],
  "seeds": [{ "x": [-1.48, -1.51, 2.04] }],
  "integrator": { "dt": 0.005, "steps": 10000, "discardInitial": 800, "maxRadius": 200 },
  "license": "CC0"
}
```

Allowed in equations: variables `x y z t`, your parameters, constants `pi e`, the
operators `+ - * / ^ ( )`, and the functions `sin cos tan asin acos atan sinh cosh tanh
exp ln log sqrt abs sign floor atan2 min max mod pow`. Nothing else — no code.

## Submitting

1. In the app, open **Define attractor → Submit ↗** (prefills an Issue), **or** open an
   issue with the *Submit an attractor* form here.
2. CI validates the equations, renders a thumbnail, and opens a PR.
3. A maintainer reviews (it's just math + a name/description) and merges.
4. `index.json` is regenerated and the attractor goes live within minutes.

## Layout

```
attractors/<author>/<id>.json   reviewed manifests
thumbnails/<author>/<id>.webp   CI-rendered previews
index.json                      generated list the app fetches
```

License: contributions default to **CC0** unless a manifest says otherwise.
