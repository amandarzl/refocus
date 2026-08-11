import daisyui from "daisyui";
import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    screens: {
      xs: "360px",
      ...defaultTheme.screens,
    },
    extend: {
      colors: {
        base: {
          DEFAULT: "#1A1A1E",
          light: "#242428",
          lighter: "#2E2E33",
          border: "#3A3A40",
        },
        accent: {
          DEFAULT: "#7C6CF0",
          hover: "#6A5AE0",
          soft: "#8F82F5",
        },
        text: {
          primary: "#F5F5F7",
          secondary: "#A1A1AA",
          muted: "#71717A",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        "refocus-dark": {
          primary: "#7C6CF0",
          "primary-content": "#FFFFFF",
          secondary: "#8F82F5",
          "secondary-content": "#FFFFFF",
          accent: "#7C6CF0",
          "accent-content": "#FFFFFF",
          neutral: "#242428",
          "neutral-content": "#F5F5F7",
          "base-100": "#1A1A1E",
          "base-200": "#242428",
          "base-300": "#2E2E33",
          "base-content": "#F5F5F7",
          info: "#3B82F6",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
        },
      },
    ],
  },
};
