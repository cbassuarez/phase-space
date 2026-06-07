import { useEffect } from "react";
import { motion } from "framer-motion";
import { Github, Download, Heart, X, ExternalLink, type LucideIcon } from "lucide-react";
import clsx from "clsx";

import { PHASE_SPACE_VERSION, PLATFORM_BADGES } from "../version";
import { isTauri, openExternal } from "../utils/tauri";

const REPO_URL = "https://github.com/cbassuarez/phase-space";
const RELEASES_URL = "https://github.com/cbassuarez/phase-space/releases";
const SPONSOR_URL = "https://github.com/sponsors/cbassuarez";

type AboutLink = {
  label: string;
  detail: string;
  href: string;
  Icon: LucideIcon;
  accent?: boolean;
};

const links: AboutLink[] = [
  {
    label: "Repository",
    detail: "Source, issues, and docs on GitHub",
    href: REPO_URL,
    Icon: Github,
  },
  {
    label: "Releases & downloads",
    detail: "Desktop builds for macOS, Windows, Linux",
    href: RELEASES_URL,
    Icon: Download,
  },
  {
    label: "Sponsor phase-space",
    detail: "Support development via GitHub Sponsors",
    href: SPONSOR_URL,
    Icon: Heart,
    accent: true,
  },
];

const ease: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

export default function AboutModal({ onClose }: { onClose: () => void }) {
  // Escape closes, and route external links through the opener when in Tauri.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleLink = (e: React.MouseEvent, href: string) => {
    if (isTauri()) {
      e.preventDefault();
      void openExternal(href);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease }}
      onClick={onClose}
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="About phase-space"
        initial={{ y: 14, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 14, scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.22, ease }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[16px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] shadow-[var(--ps-shadow-soft)]"
      >
        {/* tri-primary signal stripe */}
        <div className="flex h-1 w-full">
          <span className="flex-1 bg-[color:var(--ps-primary-red)]" />
          <span className="flex-1 bg-[color:var(--ps-primary-yellow)]" />
          <span className="flex-1 bg-[color:var(--ps-primary-blue)]" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--ps-text-muted)] transition hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 sm:p-6">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--ps-text)]">
              <span className="font-normal">phase</span>
              <span className="font-semibold">-space</span>
            </h2>
            <span className="text-xs font-medium text-[color:var(--ps-text-muted)]">
              v{PHASE_SPACE_VERSION} · beta
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[color:var(--ps-text-soft)]">
            A strange-attractor sandbox and visual instrument for looking at
            chaotic systems as moving geometry.
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {PLATFORM_BADGES.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-alt-bg)] px-2.5 py-0.5 text-[11px] font-medium tracking-tight text-[color:var(--ps-text-soft)]"
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-5 grid gap-2">
            {links.map(({ label, detail, href, Icon, accent }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleLink(e, href)}
                className="group flex items-center gap-3 rounded-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] px-3.5 py-3 transition hover:border-[color:var(--ps-text-soft)] hover:bg-[color:var(--ps-control-hover-bg)]"
              >
                <span
                  className={clsx(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    accent
                      ? "bg-[rgba(255,26,26,0.12)] text-[color:var(--ps-primary-red)]"
                      : "bg-[color:var(--ps-panel-alt-bg)] text-[color:var(--ps-text)]"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[color:var(--ps-text)]">
                    {label}
                  </span>
                  <span className="block truncate text-[12px] text-[color:var(--ps-text-muted)]">
                    {detail}
                  </span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[color:var(--ps-text-muted)] transition group-hover:text-[color:var(--ps-text-soft)]" />
              </a>
            ))}
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-[color:var(--ps-text-muted)]">
            Built by Sebastian Suarez-Solis · Rust core, WebAssembly bridge, and a
            WebGL viewer. Free and open source.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
