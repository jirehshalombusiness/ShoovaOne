/** @type {import('tailwindcss').Config} */

// Neutral scales are driven by CSS variables so light/dark theming applies
// across the whole product without per-component dark: variants.
const neutralScale = (name) =>
  Object.fromEntries(
    [
      50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
    ].map((shade) => [shade, `rgb(var(--${name}-${shade}) / <alpha-value>)`]),
  );

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#176b4d',
          dark: '#0f513a',
          soft: '#eaf5ef',
        },
        gold: '#c79a35',
        background: '#f6f7f8',
        card: '#ffffff',
        text: '#17201c',
        muted: '#718078',
        border: '#e5e9e6',
        danger: '#b84b4b',
        warning: '#9a721d',
        gray: neutralScale('gray'),
        slate: neutralScale('slate'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '14px',
        'lg': '10px',
        'md': '9px',
      },
      boxShadow: {
        'card': '0 6px 24px rgba(18,32,25,.06)',
      },
    },
  },
  plugins: [],
}
