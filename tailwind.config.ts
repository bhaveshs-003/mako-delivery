import type { Config } from "tailwindcss";

// Modern, compact design system. Neutral surfaces + a single blue brand accent;
// the 4 attribution colors are validated CVD-safe (see dataviz palette check).
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces & ink (warm-neutral, calm)
        canvas: "#f6f7f9", // page background
        surface: "#ffffff", // cards, panels
        "surface-2": "#f1f3f6", // insets, table headers, chips
        ink: "#0f172a", // primary text / headings
        "ink-2": "#475569", // secondary text
        muted: "#8a93a2", // tertiary / axis / timestamps
        line: "#e7eaf0", // hairline borders
        "line-strong": "#d4d9e2", // focused/active borders

        // Brand accent (Mako blue)
        brand: "#2a78d6",
        "brand-ink": "#1c5cab", // text-on-light brand
        navy: "#16233b", // deep brand for sidebar/hero

        // Status (from validated status palette)
        success: "#0ca30c",
        warning: "#c98500",
        danger: "#d03b3b",
        info: "#2a78d6",

        // Attribution palette — SACRED, validated CVD-safe (light steps)
        "attr-mako": "#2a78d6",
        "attr-rl": "#eb6834",
        "attr-client": "#1baf7a",
        "attr-bug": "#e34948",

        // Legacy aliases → new palette, so existing components adopt the
        // refreshed look without touching every file.
        steel: "#2a78d6", // was steel-blue → brand blue
        slate: "#475569", // secondary ink
        bg: "#f6f7f9", // page canvas
        border: "#e7eaf0", // hairline
        "border-strong": "#d4d9e2",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Slightly tightened, denser scale
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        xs: ["0.75rem", { lineHeight: "1.05rem" }],
        sm: ["0.8125rem", { lineHeight: "1.2rem" }],
        base: ["0.875rem", { lineHeight: "1.35rem" }],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15,23,42,0.04)",
        sm: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
        md: "0 4px 12px rgba(15,23,42,0.08)",
        lg: "0 8px 28px rgba(15,23,42,0.12)",
        // Soft ring used on cards for a crisp modern edge
        card: "0 0 0 1px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.04)",
        "card-hover": "0 0 0 1px rgba(15,23,42,0.07), 0 6px 20px rgba(15,23,42,0.10)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "fade-in": "fade-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
