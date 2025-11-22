import React from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import TopBar from "../components/TopBar";

type AppLayoutProps = {
  children: React.ReactNode;
};

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const isViewer =
    location.pathname === "/" ||
    location.pathname === basePath ||
    location.pathname === `${basePath}/`;
  const mainClass = clsx(
    "mx-auto flex w-full flex-1 flex-col",
    isViewer ? "overflow-hidden" : "max-w-6xl px-4 py-8 overflow-y-auto"
  );

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--ps-bg)] text-[color:var(--ps-text)]">
      <TopBar />

      {/* Page content */}
      <main className={mainClass}>
        {isViewer ? (
          <div className="mx-auto flex h-full w-full max-w-6xl flex-1 min-h-0 px-4">
            {children}
          </div>
        ) : (
          <div className="mx-auto flex w-full flex-col">{children}</div>
        )}
      </main>
    </div>
  );
};
