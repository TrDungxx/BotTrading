/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        // ✅ THÊM: IBM Plex fonts cho trading
        plex: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "'Roboto Mono'", "monospace"],
      },
      colors: {
        primary: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd8ff",
          300: "#8dc0ff",
          400: "#569eff",
          500: "#2C7BE5",
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
          500: "#00C9A7",
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
          300: "#F6C343",
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
          500: "#E63757",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          950: "#450a0a",
        },
        dark: {
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f1f5f9",
        },
        // ✅ THÊM: Trading specific colors
        long: "#0ecb81",
        short: "#f6465d",
        binance: "#fcd535",
      },

      // ============================================
      // 🎯 FLUID RESPONSIVE SYSTEM
      // Baseline: 1920px = 1x scale
      // Range: 1280px (0.67x) → 3840px (2x)
      // ============================================

      // ✅ FLUID FONT SIZES
      fontSize: {
        // Stats/Labels - smaller text
        "fluid-2xs": "var(--stats-font-xs)",      // 8-12px
        "fluid-xs": "var(--stats-font-sm)",       // 9-14px
        "fluid-sm": "var(--stats-font-md)",       // 10-16px
        "fluid-base": "var(--stats-font-lg)",     // 11-18px
        
        // Price/Display - larger text
        "fluid-lg": "var(--price-font-sm)",       // 12-24px
        "fluid-xl": "var(--price-font-md)",       // 14-28px
        "fluid-2xl": "var(--price-font-lg)",      // 16-32px
        "fluid-3xl": "var(--price-font-xl)",      // 18-36px
        
        // Mono variants for numbers/prices
        "mono-xs": ["var(--stats-font-sm)", { fontFamily: "'IBM Plex Mono', monospace" }],
        "mono-sm": ["var(--stats-font-md)", { fontFamily: "'IBM Plex Mono', monospace" }],
        "mono-base": ["var(--stats-font-lg)", { fontFamily: "'IBM Plex Mono', monospace" }],
        "mono-lg": ["var(--price-font-sm)", { fontFamily: "'IBM Plex Mono', monospace" }],
        "mono-xl": ["var(--price-font-md)", { fontFamily: "'IBM Plex Mono', monospace" }],
      },

      // ✅ FLUID SPACING (padding, margin, gap)
      spacing: {
        "fluid-1": "var(--trading-gap-xs)",       // 2-6px
        "fluid-2": "var(--trading-gap-sm)",       // 4-12px
        "fluid-3": "var(--trading-gap-md)",       // 8-16px
        "fluid-4": "var(--trading-gap-lg)",       // 12-24px
        "fluid-5": "var(--trading-gap-xl)",       // 16-32px
        
        // Component specific
        "fluid-header": "var(--header-height)",
        "fluid-ticker": "var(--ticker-height)",
        "fluid-sidebar": "var(--sidebar-width-expanded)",
        "fluid-sidebar-collapsed": "var(--sidebar-width-collapsed)",
        "fluid-orderbook": "var(--orderbook-width)",
        "fluid-form": "var(--form-width)",
      },

      // ✅ FLUID SIZES (width, height)
      width: {
        "fluid-sidebar": "var(--sidebar-width-expanded)",
        "fluid-sidebar-sm": "var(--sidebar-width-collapsed)",
        "fluid-orderbook": "var(--orderbook-width)",
        "fluid-form": "var(--form-width)",
        "fluid-icon-xs": "var(--icon-xs)",
        "fluid-icon-sm": "var(--icon-sm)",
        "fluid-icon-md": "var(--icon-md)",
        "fluid-icon-lg": "var(--icon-lg)",
      },

      height: {
        "fluid-header": "var(--header-height)",
        "fluid-ticker": "var(--ticker-height)",
        "fluid-input-sm": "var(--input-height-sm)",
        "fluid-input": "var(--input-height-md)",
        "fluid-input-lg": "var(--input-height-lg)",
        "fluid-btn-sm": "var(--btn-height-sm)",
        "fluid-btn": "var(--btn-height-md)",
        "fluid-btn-lg": "var(--btn-height-lg)",
        "fluid-row": "var(--orderbook-row-height)",
        "fluid-icon-xs": "var(--icon-xs)",
        "fluid-icon-sm": "var(--icon-sm)",
        "fluid-icon-md": "var(--icon-md)",
        "fluid-icon-lg": "var(--icon-lg)",
      },

      // ✅ FLUID MIN/MAX SIZES
      minWidth: {
        "fluid-sidebar": "var(--sidebar-width-collapsed)",
        "fluid-orderbook": "clamp(200px, 12.5vw, 280px)",
        "fluid-form": "clamp(180px, 9.375vw, 240px)",
        "fluid-table": "clamp(800px, 52.083vw, 1200px)",
      },

      maxWidth: {
        "fluid-sidebar": "var(--sidebar-width-expanded)",
        "fluid-orderbook": "clamp(280px, 20.833vw, 500px)",
        "fluid-form": "clamp(320px, 20.833vw, 500px)",
      },

      minHeight: {
        "fluid-chart": "clamp(300px, 35vh, 600px)",
        "fluid-positions": "clamp(120px, 9.375vw, 200px)",
      },

      maxHeight: {
        "fluid-positions": "clamp(200px, 18.75vw, 400px)",
        "fluid-dropdown": "clamp(200px, 20vh, 400px)",
      },

      // ✅ FLUID BORDER RADIUS
      borderRadius: {
        "fluid-sm": "var(--trading-radius-sm)",   // 2-6px
        "fluid-md": "var(--trading-radius-md)",   // 4-10px
        "fluid-lg": "var(--trading-radius-lg)",   // 6-14px
      },

      // ✅ FLUID GAP (for flex/grid)
      gap: {
        "fluid-1": "var(--trading-gap-xs)",
        "fluid-2": "var(--trading-gap-sm)",
        "fluid-3": "var(--trading-gap-md)",
        "fluid-4": "var(--trading-gap-lg)",
        "fluid-5": "var(--trading-gap-xl)",
      },

      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        // ✅ THÊM: Trading animations
        "flash-green": "flashGreen 0.4s ease",
        "flash-red": "flashRed 0.4s ease",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
      },

      keyframes: {
        pulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.8 },
        },
        // ✅ THÊM: Trading keyframes
        flashGreen: {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "rgba(16, 185, 129, 0.2)" },
        },
        flashRed: {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "rgba(239, 68, 68, 0.2)" },
        },
        slideUp: {
          from: { transform: "translateY(100%)", opacity: 0 },
          to: { transform: "translateY(0)", opacity: 1 },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },

      // ✅ THÊM: Transition timing
      transitionTimingFunction: {
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        "panel": "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      transitionDuration: {
        "fast": "150ms",
        "smooth": "250ms",
        "panel": "350ms",
      },

      // ✅ THÊM: Box shadows
      boxShadow: {
        "panel": "0 2px 8px rgba(0, 0, 0, 0.15)",
        "floating": "0 4px 20px rgba(0, 0, 0, 0.3)",
        "sheet": "0 -8px 32px rgba(0, 0, 0, 0.4)",
      },

      // ✅ THÊM: Z-index layers
      zIndex: {
        "base": "1",
        "header": "40",
        "floating": "50",
        "orderbook-mobile": "60",
        "position-tab": "70",
        "trading-tab": "80",
        "modal": "100",
      },
    },
  },
  plugins: [],
};