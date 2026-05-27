import clsx from "clsx";

type ControlSize = "xs" | "sm" | "md" | "touch";

const sizeClass: Record<ControlSize, string> = {
  xs: "min-h-7 px-2 py-1 text-[10px]",
  sm: "min-h-8 px-2.5 py-1 text-[11px]",
  md: "min-h-9 px-3 py-1.5 text-xs",
  touch: "min-h-11 px-3 py-2 text-xs",
};

export const controlTransition =
  "transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-out";

export const controlFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ps-panel-bg)]";

export const focusWithinRing =
  "focus-within:outline-none focus-within:ring-2 focus-within:ring-[color:var(--ps-focus-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[color:var(--ps-panel-bg)]";

export const disabledState =
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45";

export const sectionHeadingClass =
  "text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--ps-text-muted)]";

export const segmentedGroupClass =
  "inline-flex w-full items-center gap-1 rounded-[10px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-group-bg)] p-1 text-xs [box-shadow:var(--ps-control-group-shadow)]";

const selectedMarkerClass =
  "before:pointer-events-none before:absolute before:bottom-1 before:left-1/2 before:h-[2px] before:w-5 before:-translate-x-1/2 before:bg-[color:var(--ps-control-selected-marker)] before:content-['']";

export function segmentedButtonClass(
  active: boolean,
  options: { size?: ControlSize; fill?: boolean; marker?: boolean } = {}
) {
  const { size = "md", fill = true, marker = true } = options;
  return clsx(
    "relative inline-flex items-center justify-center gap-1.5 rounded-[8px] border font-medium leading-none outline-none",
    sizeClass[size],
    fill && "flex-1",
    controlTransition,
    controlFocusRing,
    disabledState,
    active
      ? clsx(
          "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-control-active-bg)] text-[color:var(--ps-text)] [box-shadow:var(--ps-control-active-shadow)] hover:border-[color:var(--ps-control-active-border)] hover:brightness-[1.03] active:translate-y-px active:[box-shadow:var(--ps-control-pressed-shadow)]",
          marker && selectedMarkerClass
        )
      : "border-transparent bg-transparent text-[color:var(--ps-text-soft)] hover:-translate-y-[1px] hover:border-[color:var(--ps-control-hover-border)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)] hover:[box-shadow:var(--ps-control-hover-shadow)] active:translate-y-px active:bg-[color:var(--ps-control-pressed-bg)] active:[box-shadow:var(--ps-control-pressed-shadow)]"
  );
}

export function commandButtonClass(
  active = false,
  options: { size?: ControlSize; full?: boolean } = {}
) {
  const { size = "md", full = false } = options;
  return clsx(
    "inline-flex items-center justify-center gap-1.5 rounded-[8px] border font-medium leading-none outline-none",
    sizeClass[size],
    full && "w-full",
    controlTransition,
    controlFocusRing,
    disabledState,
    active
      ? "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-control-active-bg)] text-[color:var(--ps-text)] [box-shadow:var(--ps-control-active-shadow)] hover:brightness-[1.03] active:translate-y-px active:[box-shadow:var(--ps-control-pressed-shadow)]"
      : "border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-bg)] text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)] hover:-translate-y-[1px] hover:border-[color:var(--ps-control-hover-border)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)] hover:[box-shadow:var(--ps-control-hover-shadow)] active:translate-y-px active:bg-[color:var(--ps-control-pressed-bg)] active:[box-shadow:var(--ps-control-pressed-shadow)]"
  );
}

export function iconButtonClass(active = false, options: { size?: "sm" | "md" } = {}) {
  const { size = "md" } = options;
  return clsx(
    "inline-flex shrink-0 items-center justify-center rounded-[8px] border outline-none",
    size === "sm" ? "h-8 w-8" : "h-10 w-10",
    controlTransition,
    controlFocusRing,
    disabledState,
    active
      ? "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-control-active-bg)] text-[color:var(--ps-text)] [box-shadow:var(--ps-control-active-shadow)] active:translate-y-px"
      : "border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-bg)] text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)] hover:-translate-y-[1px] hover:border-[color:var(--ps-control-hover-border)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)] hover:[box-shadow:var(--ps-control-hover-shadow)] active:translate-y-px active:bg-[color:var(--ps-control-pressed-bg)]"
  );
}

export function radioRowClass(active: boolean) {
  return clsx(
    "group relative flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[8px] border px-3 py-2 text-xs outline-none",
    controlTransition,
    focusWithinRing,
    active
      ? "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-control-active-bg)] text-[color:var(--ps-text)] [box-shadow:var(--ps-control-active-shadow)]"
      : "border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-bg)] text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)] hover:-translate-y-[1px] hover:border-[color:var(--ps-control-hover-border)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)] hover:[box-shadow:var(--ps-control-hover-shadow)] active:translate-y-px active:bg-[color:var(--ps-control-pressed-bg)]"
  );
}

export function radioIndicatorClass(active: boolean) {
  return clsx(
    "relative h-4 w-4 shrink-0 rounded-full border transition-[background-color,border-color,box-shadow] duration-150",
    active
      ? "border-[color:var(--ps-control-active-border)] bg-[color:var(--ps-control-selected-marker)] shadow-[inset_0_0_0_4px_var(--ps-control-active-bg)]"
      : "border-[color:var(--ps-border-strong)] bg-white group-hover:border-[color:var(--ps-control-hover-border)]"
  );
}

export const srInputClass = "sr-only";

export const selectClass = clsx(
  "min-h-11 w-full rounded-[8px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-control-bg)] px-2.5 py-1.5 text-[11px] text-[color:var(--ps-text)] [box-shadow:var(--ps-control-shadow)] outline-none md:min-h-9",
  controlTransition,
  controlFocusRing,
  disabledState,
  "hover:border-[color:var(--ps-control-hover-border)] hover:bg-[color:var(--ps-control-hover-bg)] disabled:text-[color:var(--ps-text-muted)]"
);

export const rangeClass = "phase-range w-full focus:outline-none disabled:opacity-45";

export const disclosureSummaryClass = clsx(
  "flex min-h-9 cursor-pointer select-none list-none items-center justify-between gap-2 rounded-[8px] border border-transparent px-2 py-1.5 [&::-webkit-details-marker]:hidden",
  sectionHeadingClass,
  controlTransition,
  controlFocusRing,
  "hover:border-[color:var(--ps-control-hover-border)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)] active:translate-y-px"
);

export const sheetHandleButtonClass = clsx(
  "flex min-h-12 w-full flex-col items-center justify-center gap-1 border-b border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ps-text-muted)] outline-none",
  controlTransition,
  controlFocusRing,
  "hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)] active:bg-[color:var(--ps-control-pressed-bg)]"
);

export const passiveChipClass =
  "inline-flex min-h-8 items-center justify-center rounded-[8px] border border-[color:var(--ps-control-border)] bg-[color:var(--ps-panel-bg)] px-3 py-1 text-[11px] text-[color:var(--ps-text-soft)] [box-shadow:var(--ps-control-shadow)]";
