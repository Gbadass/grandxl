const baseConfig = require('@grandxl/ui/tailwind')

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      ...baseConfig.theme?.extend,
      keyframes: {
        'slide-in-up': {
          from: { transform: 'translateY(110%)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
      },
      animation: {
        'slide-in-up': 'slide-in-up 0.35s ease-out',
      },
    },
  },
}
