import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "../state/themeState";
import { controlFocusRing, controlTransition } from "./controls/controlStyles";

const OPTIONS: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dim", label: "Dim", Icon: Moon },
];

/**
 * Global light/dim theme switch for the top bar. Two-segment toggle: the active
 * side carries the control-active fill; icons (sun / moon) make the meaning
 * legible even when the labels are hidden on narrow widths.
 */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-[9px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-group-bg)] p-0.5 [box-shadow:var(--ps-control-group-shadow)]"
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={active}
            title={`${label} theme`}
            className={clsx(
              "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[7px] border px-2 text-[11px] font-medium leading-none outline-none",
              controlTransition,
              controlFocusRing,
              active
                ? "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-control-active-bg)] text-[color:var(--ps-text)] [box-shadow:var(--ps-control-active-shadow)]"
                : "border-transparent bg-transparent text-[color:var(--ps-text-soft)] hover:text-[color:var(--ps-text)]"
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSwitch;
