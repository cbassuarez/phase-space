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
    "flex h-full w-full",
    isViewer
      ? "items-stretch justify-center overflow-hidden px-[clamp(8px,3vw,24px)] py-[clamp(8px,2vh,20px)]"
      : "overflow-y-auto"
  );

  return (
    <div className="min-h-[100dvh] grid grid-rows-[auto,minmax(0,1fr)] bg-[color:var(--ps-bg)] text-[color:var(--ps-text)]">
      <TopBar />

      {/* Page content */}
      <main className={mainClass}>
        {isViewer ? (
          <div className="h-full w-full max-w-[1440px] min-h-0">{children}</div>
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8">{children}</div>
        )}
      </main>
    </div>
  );
};
