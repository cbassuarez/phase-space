/* tslint:disable */
/* eslint-disable */
/**
 * Set up better panic messages in the browser console.
 */
export function start(): void;
export class WasmEngine {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Integrate a scene described by JSON SceneSpec, return an array-of-arrays of points
   * shaped as: `[[[x,y,z], ...], ...]` where outer index = trajectory index.
   */
  integrate_scene(scene_json: string): any;
  /**
   * Validate user-defined attractor equations. Input JSON:
   * `{ "equations": { "dx", "dy", "dz" }, "params": { name: number } }`.
   * Returns `{ ok: bool, errors: { dx, dy, dz } }` where each error is
   * `null` (valid) or `{ message, pos }`. The same parser the integrator
   * uses, so "valid here" means "runnable" — reused by the modal and CI.
   */
  validate_attractor(json: string): any;
  /**
   * Return a default Aizawa scene spec JSON string.
   */
  default_aizawa_scene(): string;
  /**
   * Return a default Lorenz scene spec JSON string.
   */
  default_lorenz_scene(): string;
  /**
   * Return a default Thomas scene spec JSON string.
   */
  default_thomas_scene(): string;
  /**
   * Return a default Rössler scene spec JSON string.
   */
  default_rossler_scene(): string;
  /**
   * Integrate a scene described by a JavaScript SceneSpec object.
   */
  integrate_scene_value(scene_value: any): any;
  constructor();
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmengine_free: (a: number, b: number) => void;
  readonly start: () => void;
  readonly wasmengine_default_aizawa_scene: (a: number) => [number, number];
  readonly wasmengine_default_lorenz_scene: (a: number) => [number, number];
  readonly wasmengine_default_rossler_scene: (a: number) => [number, number];
  readonly wasmengine_default_thomas_scene: (a: number) => [number, number];
  readonly wasmengine_integrate_scene: (a: number, b: number, c: number) => [number, number, number];
  readonly wasmengine_integrate_scene_value: (a: number, b: any) => [number, number, number];
  readonly wasmengine_new: () => number;
  readonly wasmengine_validate_attractor: (a: number, b: number, c: number) => [number, number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
