const baseConfig = require('@grandxl/ui/tailwind')

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
}
