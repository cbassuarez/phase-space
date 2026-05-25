import React from "react";
import clsx from "clsx";

type ContentKind = "prose" | "gallery";

interface ContentPageShellProps {
  kind?: ContentKind;
  children: React.ReactNode;
}

/**
 * ContentPageShell
 *
 * - Used ONLY by non-viewer pages (/about, /credits).
 * - Viewer route (/), PhaseViewerPage, MainLayout, etc. must NOT use this shell.
 * - Provides a responsive, mobile-first canvas with:
 *   - full-bleed background in our ps palette
 *   - horizontally centered inner container
 *   - kind-specific max-width and spacing
 */
export const ContentPageShell: React.FC<ContentPageShellProps> = ({
  kind = "prose",
  children,
}) => {
  const maxWidth =
    kind === "prose"
      ? "max-w-3xl" // narrower, good for long text
      : "max-w-6xl"; // wider, good for grids/cards

  return (
    <div className="flex flex-1 justify-center bg-[color:var(--ps-bg)] px-2 sm:px-4 lg:px-6">
      <div
        className={clsx(
          "w-full",
          maxWidth,
          "mx-auto",
          "px-1 sm:px-0",
          // Horizontal padding + vertical rhythm
          "space-y-6",
          "sm:space-y-8",
          "lg:space-y-10"
        )}
      >
        {children}
      </div>
    </div>
  );
};
