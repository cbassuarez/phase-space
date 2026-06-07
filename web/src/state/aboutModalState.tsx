import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence } from "framer-motion";

import AboutModal from "../components/AboutModal";
import { onMenuEvent } from "../utils/tauri";

type AboutModalContextValue = {
  open: () => void;
  close: () => void;
};

const AboutModalContext = createContext<AboutModalContextValue | null>(null);

export const AboutModalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Native desktop menu: "About phase-space" opens this modal; "Reload View"
  // refreshes. No-op in the browser build.
  useEffect(() => {
    let dispose = () => {};
    onMenuEvent((id) => {
      if (id === "about") setIsOpen(true);
      else if (id === "reload") window.location.reload();
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => dispose();
  }, []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <AboutModalContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {isOpen && <AboutModal onClose={close} />}
      </AnimatePresence>
    </AboutModalContext.Provider>
  );
};

export function useAboutModal(): AboutModalContextValue {
  const ctx = useContext(AboutModalContext);
  if (!ctx) {
    throw new Error("useAboutModal must be used within an AboutModalProvider");
  }
  return ctx;
}
