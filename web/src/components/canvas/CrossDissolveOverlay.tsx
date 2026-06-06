import { motion } from "framer-motion";
import { DISSOLVE_MS } from "../../visual/transitionConfig";

/**
 * Freeze-frame cross-dissolve. When a structural change rebuilds the scene
 * (render style, palette, system, resolution), the parent snapshots the OLD
 * frame into `src`; this fades that snapshot out over the live new render so
 * the swap dissolves instead of popping. Keyed on `src` so a rapid second
 * change restarts the fade on the newest snapshot.
 */
export function CrossDissolveOverlay({
  src,
  onDone,
}: {
  src: string | null;
  onDone: () => void;
}) {
  if (!src) return null;
  return (
    <motion.img
      key={src}
      src={src}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: DISSOLVE_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={onDone}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full object-fill"
    />
  );
}

export default CrossDissolveOverlay;
