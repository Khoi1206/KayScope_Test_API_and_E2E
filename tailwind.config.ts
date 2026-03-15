import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'th-bg':          'var(--th-bg)',
        'th-nav':         'var(--th-nav)',
        'th-sidebar':     'var(--th-sidebar)',
        'th-tabbar':      'var(--th-tabbar)',
        'th-surface':     'var(--th-surface)',
        'th-raised':      'var(--th-raised)',
        'th-input':       'var(--th-input)',
        'th-border':      'var(--th-border)',
        'th-border-soft': 'var(--th-border-soft)',
        'th-text':        'var(--th-text)',
        'th-text-2':      'var(--th-text-2)',
        'th-text-3':      'var(--th-text-3)',
      },
    },
  },
  plugins: [],
};
export default config;
