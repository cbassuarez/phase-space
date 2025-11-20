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
    "mx-auto flex w-full flex-col",
    isViewer ? undefined : "max-w-6xl px-4 py-8"
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar />

      {/* Page content */}
      <main className={mainClass}>
        {children}
      </main>
    </div>
  );
};
