import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";

type AppLayoutProps = {
  children: React.ReactNode;
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    "text-sm font-medium transition-colors",
    isActive
      ? "text-slate-900"
      : "text-slate-500 hover:text-slate-900"
  );

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isViewer = location.pathname === "/";
  const mainClass = clsx(
    "mx-auto flex w-full flex-col",
    isViewer ? undefined : "max-w-6xl px-4 py-8"
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top nav */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-[0.15em] uppercase text-slate-900">
              Phase Space
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-50">
              Beta
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink to="/" className={navLinkClass}>
              Viewer
            </NavLink>
            <NavLink to="/systems" className={navLinkClass}>
              Systems
            </NavLink>
            <NavLink to="/presets" className={navLinkClass}>
              Presets
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className={mainClass}>
        {children}
      </main>
    </div>
  );
};
