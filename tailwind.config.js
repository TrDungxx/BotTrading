/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        primary: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd8ff",
          300: "#8dc0ff",
          400: "#569eff",
          500: "#2C7BE5", // Main primary color
          600: "#1a5fc9",
          700: "#174da6",
          800: "#17408a",
          900: "#183973",
          950: "#12254a",
        },
        success: {
          50: "#effef7",
          100: "#d7faeb",
          200: "#b2f2d8",
          300: "#79e5bf",
          400: "#3ecfa0",
          500: "#00C9A7", // Success color
          600: "#0d936c",
          700: "#107557",
          800: "#125e47",
          900: "#124d3b",
          950: "#062b21",
        },
        warning: {
          50: "#fffaeb",
          100: "#fff0c7",
          200: "#fee289",
          300: "#F6C343", // Warning color
          400: "#f9ae2b",
          500: "#f8941a",
          600: "#e97610",
          700: "#c1570f",
          800: "#9a4514",
          900: "#7c3915",
          950: "#431c08",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#E63757", // Danger color
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          950: "#450a0a",
        },
        dark: {
          900: "#0f172a", // Darkest background
          800: "#1e293b", // Dark background
          700: "#334155", // Lighter dark
          600: "#475569", // Border color
          500: "#64748b", // Muted text
          400: "#94a3b8", // Secondary text
          300: "#cbd5e1", // Primary text
          200: "#e2e8f0", // Bright text
          100: "#f1f5f9", // Brightest text
        },
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.8 },
        },
      },
    },
  },
  plugins: [],
};
