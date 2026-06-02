/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Hextech 主题色板(英雄联盟客户端风格)
        'hex-gold': '#C8AA6E',
        'hex-gold-light': '#F0E6D2',
        'hex-gold-dark': '#785A28',
        'hex-blue': '#0AC8B9',
        'hex-blue-light': '#0397AB',
        'hex-blue-dark': '#005A82',
        'hex-bg': '#010A13',
        'hex-bg-2': '#0A1428',
        'hex-panel': '#1E2328',
        'hex-panel-light': '#3C3C41',
        'hex-text': '#F0E6D2',
        'hex-text-muted': '#A09B8C',
      },
      fontFamily: {
        'display': ['Rajdhani', 'system-ui', 'sans-serif'],
        'sans': ['Rajdhani', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
