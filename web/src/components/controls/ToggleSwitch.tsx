import clsx from "clsx";

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

function ToggleSwitch({ label, checked, onToggle }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-[color:var(--ps-text-soft)]">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          "relative inline-flex h-5 w-9 items-center rounded-full transition",
          checked
            ? "bg-[color:var(--ps-accent)] shadow-md"
            : "bg-[color:var(--ps-panel-alt-bg)]"
        )}
      >
        <span
          className={clsx(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform",
            checked ? "translate-x-4" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

export default ToggleSwitch;
