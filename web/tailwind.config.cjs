/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ps: {
          bg: "var(--ps-bg)",
          panel: "var(--ps-panel-bg)",
          alt: "var(--ps-panel-alt-bg)",
          borderSubtle: "var(--ps-border-subtle)",
          borderStrong: "var(--ps-border-strong)",
          text: "var(--ps-text)",
          textSoft: "var(--ps-text-soft)",
          textMuted: "var(--ps-text-muted)",
          primaryRed: "var(--ps-primary-red)",
          primaryBlue: "var(--ps-primary-blue)",
          primaryYellow: "var(--ps-primary-yellow)",
          accent: "var(--ps-accent)",
        },
      },
      boxShadow: {
        soft: "var(--ps-shadow-soft)",
        subtle: "var(--ps-shadow-subtle)",
        inner: "var(--ps-shadow-inner)",
      },
      borderRadius: {
        lg: "var(--ps-radius-lg)",
        md: "var(--ps-radius-md)",
        sm: "var(--ps-radius-sm)",
      },
      transitionTimingFunction: {
        psEaseOut: "var(--ps-ease-out)",
      },
      transitionDuration: {
        fast: "var(--ps-duration-fast)",
        med: "var(--ps-duration-med)",
      },
    },
  },
  plugins: [],
};
