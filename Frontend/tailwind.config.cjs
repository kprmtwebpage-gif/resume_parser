/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F5FF',
          100: '#E6EFFF',
          200: '#C7DDFF',
          300: '#93B9FF',
          400: '#5C8EFF',
          500: '#1F4FD8',
          600: '#1A42B8',
          700: '#153598',
          800: '#102978',
          900: '#0B1D58'
        },
        neutral: {
          50: '#FAFBFC',
          100: '#F5F7FA',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#1A1A1A'
        }
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
        button: '0 1px 2px rgba(0, 0, 0, 0.05)',
        modal: '0 20px 40px rgba(0, 0, 0, 0.15)'
      },
      borderRadius: {
        card: '8px',
        button: '6px'
      }
    }
  },
  plugins: []
}
