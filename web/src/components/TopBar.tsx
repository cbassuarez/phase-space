const githubUrl = "https://github.com/phase-space/phase-space";

function TopBar() {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="w-full border-b border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-bg)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16">
        <div className="text-lg font-semibold tracking-tight text-[color:var(--ps-text)]">
          <span className="font-normal">phase</span>
          <span className="font-semibold">-space</span>
        </div>
        <nav className="flex items-center gap-4 text-xs text-[color:var(--ps-text-soft)] md:text-sm">
          <button
            className="text-[color:var(--ps-accent)] underline decoration-2 underline-offset-4"
            onClick={() => scrollToSection("viewer")}
          >
            Viewer
          </button>
          <button className="hidden md:inline hover:text-[color:var(--ps-text)]" onClick={() => scrollToSection("systems")}>
            Systems
          </button>
          <button className="hidden md:inline hover:text-[color:var(--ps-text)]" onClick={() => scrollToSection("about")}>
            About
          </button>
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
        </nav>
      </div>
    </header>
  );
}

export default TopBar;
