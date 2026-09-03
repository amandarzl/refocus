import defaultTheme from "tailwindcss/defaultTheme";

// Design tokens are CSS custom properties (see src/index.css), keyed off the
// `data-theme` attribute App.jsx already sets on the document root. Each
// color below reads its RGB triple from a --color-* var via Tailwind's
// rgb(var(--x) / <alpha-value>) pattern, so opacity modifiers like
// bg-surface-canvas/50 keep working, and swapping a value only ever means
// editing index.css in one place — not hunting hex literals across
// components.
function withOpacity(variableName) {
  return `rgb(var(${variableName}) / <alpha-value>)`;
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    screens: {
      ...defaultTheme.screens,
    },
    extend: {
      colors: {
        surface: {
          canvas: withOpacity("--color-surface-canvas"),
          raised: withOpacity("--color-surface-raised"),
          sunken: withOpacity("--color-surface-sunken"),
          overlay: withOpacity("--color-surface-overlay"),
        },
        border: {
          DEFAULT: withOpacity("--color-border-default"),
          strong: withOpacity("--color-border-strong"),
        },
        ink: {
          primary: withOpacity("--color-ink-primary"),
          secondary: withOpacity("--color-ink-secondary"),
          muted: withOpacity("--color-ink-muted"),
        },
        accent: {
          primary: withOpacity("--color-accent-primary"),
          "primary-hover": withOpacity("--color-accent-primary-hover"),
          "primary-soft": withOpacity("--color-accent-primary-soft"),
          "primary-ink": withOpacity("--color-accent-primary-ink"),
          warm: withOpacity("--color-accent-warm"),
          "warm-soft": withOpacity("--color-accent-warm-soft"),
        },
        danger: {
          DEFAULT: withOpacity("--color-danger-default"),
          hover: withOpacity("--color-danger-hover"),
        },
        focus: {
          ring: withOpacity("--color-focus-ring"),
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        control: "10px",
        panel: "16px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};
