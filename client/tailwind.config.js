/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          // Core palette — measured from spec
          bg:        '#fcfcfd',   // page background
          surface:   '#ffffff',   // card / panel surface
          'surface-2': '#f5f5f6', // subtly tinted surface (alt rows, banners)
          text:      '#08152e',   // primary text + accent (CTAs, links)
          muted:     '#787878',   // secondary / caption text
          faint:     '#a8a8a8',   // tertiary / disabled
          line:      '#d8d8d8',   // separator lines
          blue:      '#60a8ff',   // palette blue (use sparingly — one per viewport)
        },
        status: {
          success: '#16a34a',
          error:   '#dc2626',
          warning: '#d97706',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        full: '9999px',
      },
      letterSpacing: {
        tight:  '-0.02em',
        tighter: '-0.025em',
        label:  '0.08em',
      },
    },
  },
  plugins: [],
}
