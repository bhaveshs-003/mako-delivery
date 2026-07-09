import type { Config } from "tailwindcss";

// Design tokens per Mako spec §1. Corporate, muted, high-trust aesthetic.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1F2A44",
        steel: "#3A5A78",
        slate: "#5B6774",
        surface: "#FFFFFF",
        border: "#E2E6EB",
        "border-strong": "#CBD2DA",
        bg: "#F7F8FA",
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
        info: "#2563EB",
        // Attribution palette — SACRED, identical everywhere (§6.1)
        "attr-mako": "#3A5A78",
        "attr-rl": "#7C3AED",
        "attr-client": "#0891B2",
        "attr-bug": "#DC2626",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.04)",
        md: "0 2px 8px rgba(0,0,0,0.08)",
        lg: "0 4px 16px rgba(0,0,0,0.12)",
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      },
      keyframes: {
        "pulse-amber": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "pulse-amber": "pulse-amber 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
