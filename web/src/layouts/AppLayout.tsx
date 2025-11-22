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

    const rootClass = clsx(
        // base shell
        "flex min-h-screen flex-col bg-slate-50 text-slate-900",
        // on viewer route: hard-clamp to viewport and hide overflow
        isViewer && "h-screen overflow-hidden"
    );

    const mainClass = clsx(
        // main is always a flex column that can shrink
        "flex w-full flex-1 flex-col min-h-0",
        // viewer: fill shell and prevent its own scrolling
        isViewer
            ? "overflow-hidden"
            // non-viewer: centered, scrollable content
            : "mx-auto max-w-6xl px-4 py-8"
    );

    return (
        <div className={rootClass}>
            <TopBar />
            <main className={mainClass}>{children}</main>
        </div>
    );
};
