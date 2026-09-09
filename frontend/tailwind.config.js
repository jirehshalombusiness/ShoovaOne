/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
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