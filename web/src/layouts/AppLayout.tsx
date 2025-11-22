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
    "flex w-full flex-1 flex-col min-h-0",
    isViewer ? undefined : "mx-auto max-w-6xl px-4 py-8"
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar />

      {/* Page content */}
      <main className={mainClass}>{children}</main>
    </div>
  );
};
