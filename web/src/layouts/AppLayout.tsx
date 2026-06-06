import React, { useLayoutEffect } from "react";
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

    useLayoutEffect(() => {
        if (isViewer) {
            document.body.classList.add("viewer-route");
        } else {
            document.body.classList.remove("viewer-route");
        }

        return () => {
            document.body.classList.remove("viewer-route");
        };
    }, [isViewer]);

    const rootClass = clsx(
        // base shell — themed via tokens so the light/dim switch drives the whole site
        "flex min-h-screen flex-col bg-[color:var(--ps-bg)] text-[color:var(--ps-text)]",
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
            : "overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
    );

    return (
        <div className={rootClass}>
            <TopBar />
            <main className={mainClass}>{children}</main>
        </div>
    );
};
