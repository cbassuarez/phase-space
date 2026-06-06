// Time constants for expressive viewer transitions. `tau` is the exponential
// approach time constant in seconds (~63% of the way there per tau; settles
// visually in ~3·tau). Reduced-motion bypasses all of these (instant snap).

export const TAU_MATERIAL = 0.18; // roughness/metallic/emissive/exposure/alpha
export const TAU_LIGHTING = 0.22; // key/fill intensity, colours, dirs, ambient
export const TAU_SCALARS = 0.16; // ribbon width, cloud density, palette-shift, opacity
export const TAU_CELLSHAPE = 0.2; // uShape morph between cell shapes

/** Seconds over which a camera mode-change spring ramps from soft back to tight. */
export const CAMERA_MODE_GLIDE_TAU = 0.9;

/** Structural cross-dissolve duration (ms). */
export const DISSOLVE_MS = 500;
