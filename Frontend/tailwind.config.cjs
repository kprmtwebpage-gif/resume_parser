/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7ff',
          100: '#e6f0ff',
          200: '#c8ddff',
          300: '#9fc1ff',
          400: '#6a9bff',
          500: '#3e74ff',
          600: '#2456f5',
          700: '#1e43d1',
          800: '#1e3aa6',
          900: '#1d3384'
        }
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)'
      }
    }
  },
  plugins: []
}
