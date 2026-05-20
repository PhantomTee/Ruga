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
          black: "#0a0a0a",
          panel: "#101310",
          green: "#00ff41",
          red: "#ff3131",
          amber: "#f7c948",
          line: "#1f2a1f"
        }
      },
      fontFamily: {
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "ui-monospace", "monospace"]
      },
      animation: {
        flash: "flash 1.8s ease-out",
        scan: "scan 1.4s linear infinite"
      },
      keyframes: {
        flash: {
          "0%": { backgroundColor: "rgba(0,255,65,0.22)" },
          "100%": { backgroundColor: "transparent" }
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
