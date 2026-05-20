import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ruga: {
          red: "#FF1515",
          black: "#000000",
          white: "#FFFFFF",
          dim: "#CC0000"
        }
      },
      fontFamily: {
        display: ["var(--font-permanent-marker)", "Permanent Marker", "Impact", "cursive"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "ui-monospace", "monospace"]
      },
      keyframes: {
        flash: {
          "0%": { opacity: "0.6" },
          "100%": { opacity: "0" }
        }
      },
      animation: {
        flash: "flash 1.6s ease-out"
      }
    }
  },
  plugins: []
};

export default config;
