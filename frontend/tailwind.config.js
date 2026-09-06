/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        /*
         * Theme-aware application surfaces.
         */
        ink: {
          900: "rgb(var(--ink-900) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
        },

        /*
         * We deliberately make text-white adaptive.
         * In light mode it becomes dark primary text.
         * In dark mode it becomes near-white.
         */
        white: "rgb(var(--text-primary) / <alpha-value>)",

        /*
         * IMPORTANT:
         *
         * Do NOT redefine `slate`.
         * Tailwind's normal slate palette is needed for:
         *
         * text-slate-700 dark:text-slate-300
         * text-slate-600 dark:text-slate-400
         * etc.
         */

        fire: {
          50: "#fff3ed",
          100: "#ffe0d0",
          200: "#ffbfa0",
          300: "#ff9b6b",
          400: "#ff7a45",
          500: "#ff5722",
          600: "#e8451a",
          700: "#c13515",
          800: "#9a2a12",
          900: "#6e1f0e",
        },

        ember: {
          400: "#ffc947",
          500: "#ffa726",
          600: "#f09020",
        },
      },

      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "sans-serif",
        ],

        mono: [
          "JetBrains Mono",
          "monospace",
        ],
      },
    },
  },

  plugins: [],
};