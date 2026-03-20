/**
 * DASHBOARD THEME — Tailwind Config Extension
 * ─────────────────────────────────────────────────────────
 * Merge this into your project's tailwind.config.cjs/js
 * to register the design system's color tokens as Tailwind utilities.
 *
 * Usage:
 *   const { themeExtension } = require('./src/theme/tailwind.extend')
 *   module.exports = {
 *     theme: { extend: themeExtension },
 *     ...
 *   }
 *
 * Or spread it manually:
 *   theme: {
 *     extend: {
 *       colors: { ...themeExtension.colors },
 *       fontFamily: { ...themeExtension.fontFamily },
 *       ...
 *     }
 *   }
 */

const themeExtension = {
  colors: {
    /* ── Admin palette ───────────────────────── */
    admin: {
      primary:   '#2563EB',  // Blue-600
      teal:      '#10B981',  // Emerald-500
      amber:     '#F59E0B',  // Amber-400
      indigo:    '#6366F1',  // Indigo-500
      text:      '#111827',  // Gray-900
      secondary: '#4B5563',  // Gray-600
      border:    '#E5E7EB',  // Gray-200
    },
    /* ── Layout surfaces ─────────────────────── */
    sidebar:  '#111827',
    'page-bg': '#F8FAFC',
    /* ── Semantic chart colors ───────────────── */
    chart: {
      1: '#2563EB',
      2: '#10B981',
      3: '#F59E0B',
      4: '#6366F1',
      5: '#EC4899',
      6: '#06B6D4',
      7: '#8B5CF6',
      8: '#EF4444',
      9: '#14B8A6',
      10: '#F97316',
    },
  },

  fontFamily: {
    /* Use: font-admin or font-sans (if overriding) */
    admin: ["'Inter'", "'Segoe UI'", 'system-ui', '-apple-system', 'sans-serif'],
  },

  fontSize: {
    'kpi-label': ['11px', { lineHeight: '1.4', letterSpacing: '0.04em', fontWeight: '500' }],
    'kpi-value': ['28px', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '800' }],
    'section-heading': ['15px', { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '800' }],
  },

  boxShadow: {
    'card-lg': '0 4px 24px rgba(0,0,0,0.08)',
    'card-hover': '0 8px 32px rgba(0,0,0,0.12)',
    'drawer': '0 20px 60px rgba(0,0,0,0.20)',
  },

  borderRadius: {
    'card': '16px',    // rounded-2xl equivalent
    'chip': '999px',   // fully rounded pills
  },
}

module.exports = { themeExtension }
