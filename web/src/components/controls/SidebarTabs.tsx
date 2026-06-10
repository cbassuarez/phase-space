import type { KeyboardEvent } from "react";
import clsx from "clsx";
import { AudioLines, RadioTower, Sparkles, Video, type LucideIcon } from "lucide-react";
import { controlFocusRing, controlTransition } from "./controlStyles";

export type SidebarTabId = "scene" | "camera" | "audio" | "output";

const TABS: { id: SidebarTabId; label: string; Icon: LucideIcon }[] = [
  { id: "scene", label: "Scene", Icon: Sparkles },
  { id: "camera", label: "Camera", Icon: Video },
  { id: "audio", label: "Audio", Icon: AudioLines },
  { id: "output", label: "Output", Icon: RadioTower },
];

export const SIDEBAR_TAB_ORDER: SidebarTabId[] = TABS.map((t) => t.id);

/**
 * Folder-style tabs for the desktop sidebar. The active tab is raised, shares
 * the body's fill, and drops its bottom border so it merges into the folder
 * body below — a -1px overlap (`-mb-px`) closes the seam, the classic file-tab
 * read. Inactive tabs sit back, recessed onto the body's top edge. Icon + label
 * carry the semiotics; ←/→ move between tabs.
 *
 * Must be rendered directly above the folder body with no gap between them, and
 * the body needs `position: relative` so the active tab's overlap lands on its
 * top border.
 */
export function SidebarTabs({
  active,
  onSelect,
}: {
  active: SidebarTabId;
  onSelect: (id: SidebarTabId) => void;
}) {
  const activeIndex = SIDEBAR_TAB_ORDER.indexOf(active);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (activeIndex + dir + TABS.length) % TABS.length;
    onSelect(SIDEBAR_TAB_ORDER[next]);
  };

  return (
    <div
      role="tablist"
      aria-label="Control sections"
      onKeyDown={onKeyDown}
      className="relative z-10 flex items-end gap-1.5 px-1"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(id)}
            className={clsx(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-t-[10px] border px-3 text-xs font-medium outline-none",
              controlTransition,
              controlFocusRing,
              isActive
                ? // Raised, fills like the body, no bottom border → merges down.
                  "z-10 -mb-px min-h-[2.3rem] border-[color:var(--ps-border-subtle)] border-b-transparent bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)]"
                : // Recessed onto the body's top edge.
                  "min-h-9 border-transparent bg-[color:var(--ps-control-group-bg)] text-[color:var(--ps-text-soft)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)]"
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
