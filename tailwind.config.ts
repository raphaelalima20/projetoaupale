import type { Config } from "tailwindcss";

/**
 * Semantic color tokens are backed by CSS variables (see globals.css) so the same class names
 * (bg-surface, text-textDim, text-gold...) resolve to the light or dark AUPALE palette.
 * Values are space-separated RGB channels so Tailwind opacity modifiers (bg-gold/30) work.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: token("primary"),
          dark: token("primary-dark"),
          fg: token("primary-fg"),
        },
        gold: {
          DEFAULT: token("gold"),
          light: token("gold-light"),
          dark: token("gold-dark"),
          dim: "rgb(var(--gold) / 0.15)",
        },
        background: token("background"),
        surface: token("surface"),
        surface2: token("surface2"),
        border: token("border"),
        text: token("text"),
        textDim: token("text-dim"),
        overlay: token("overlay"),
        success: token("success"),
        danger: token("danger"),
        info: token("info"),
        warn: token("warn"),
        pink: token("pink"),
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        btn: "12px",
        badge: "20px",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        modal: "var(--shadow-modal)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        fadeInOverlay: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.35s ease both",
        slideIn: "slideIn 0.25s ease both",
        fadeInOverlay: "fadeInOverlay 0.2s ease both",
      },
    },
  },
  plugins: [],
};
export default config;
