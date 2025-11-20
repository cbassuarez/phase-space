import { Link, NavLink } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import VersionBadge from "./VersionBadge";
import { PHASE_SPACE_VERSION } from "../version";

const githubUrl = "https://github.com/phase-space/phase-space";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative text-xs font-medium transition-colors hover:text-[color:var(--ps-text)] md:text-sm ${
    isActive ? "text-[color:var(--ps-text)]" : "text-[color:var(--ps-text-soft)]"
  }`;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia === "undefined") return undefined;
    const mql = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function TopBar() {
  const wordmarkRef = useRef<HTMLSpanElement | null>(null);
  const [useShortWordmark, setUseShortWordmark] = useState(false);
  const mobilePortrait = useMediaQuery("(max-width: 768px) and (orientation: portrait)");
  const versionLabel = `phase-space v${PHASE_SPACE_VERSION} • beta`;

  useEffect(() => {
    if (!mobilePortrait) {
      setUseShortWordmark(false);
      return;
    }

    const el = wordmarkRef.current;
    if (!el) return;

    const checkWrap = () => {
      const isWrapped = el.scrollHeight > el.clientHeight + 1;
      setUseShortWordmark(isWrapped);
    };

    checkWrap();
    const resizeObserver = new ResizeObserver(checkWrap);
    resizeObserver.observe(el);
    window.addEventListener("resize", checkWrap);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkWrap);
    };
  }, [mobilePortrait]);

  const wordmark = useMemo(
    () => (mobilePortrait && useShortWordmark ? "p-s" : "phase-space"),
    [mobilePortrait, useShortWordmark]
  );

  return (
    <header className="w-full border-b border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-bg)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16">
        <Link to="/" className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
          <span ref={wordmarkRef} className="block whitespace-normal">
            {wordmark === "phase-space" ? (
              <>
                <span className="font-normal">phase</span>
                <span className="font-semibold">-space</span>
              </>
            ) : (
              <span className="font-semibold">p-s</span>
            )}
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-4 text-xs text-[color:var(--ps-text-soft)] md:text-sm">
            <NavLink to="/" className={navLinkClass}>
              Viewer
            </NavLink>
            <NavLink to="/systems" className={navLinkClass}>
              Systems
            </NavLink>
            <NavLink to="/presets" className={navLinkClass}>
              Presets
            </NavLink>
            <NavLink to="/field-notes" className={navLinkClass}>
              Field Notes
            </NavLink>
            <NavLink to="/credits" className={navLinkClass}>
              Credits
            </NavLink>
          </nav>
          {!mobilePortrait && <VersionBadge label={versionLabel} />}
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--ps-border-subtle)] transition hover:bg-white hover:shadow-md"
            aria-label="Open GitHub repository"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4 text-[color:var(--ps-text)]"
            >
              <path d="M12 .5C5.65.5.5 5.64.5 12.02c0 5.1 3.29 9.43 7.86 10.96.57.1.78-.24.78-.55 0-.27-.01-1.14-.02-2.07-3.2.7-3.88-1.37-3.88-1.37-.52-1.31-1.27-1.66-1.27-1.66-1.04-.7.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.75.4-1.24.73-1.52-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.3 1.18-3.11-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.14 1.19a10.9 10.9 0 0 1 2.86-.39c.97 0 1.95.13 2.86.39 2.17-1.5 3.13-1.19 3.13-1.19.63 1.58.24 2.75.12 3.04.74.81 1.18 1.85 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.77 1.08.77 2.18 0 1.57-.02 2.84-.02 3.23 0 .3.2.65.79.54A10.54 10.54 0 0 0 23.5 12C23.5 5.64 18.35.5 12 .5Z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
