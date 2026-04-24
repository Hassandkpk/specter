import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'sky-bg': '#e8f0fa',
        'sky-card': '#ffffff',
        'sky-border': '#c8d9ef',
        'sky-nav': '#d1e2f5',
        'navy': '#0f172a',
        'navy-hover': '#1e293b',
        'slate-mid': '#475569',
        'slate-muted': '#94a3b8',
        'z-orange': '#ff4f00',
      },
      fontFamily: {
        heading: ['var(--font-display)', 'Helvetica', 'Arial', 'sans-serif'],
        sans: ['var(--font-inter)', 'Helvetica', 'Arial', 'sans-serif'],
        editorial: ['var(--font-editorial)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
