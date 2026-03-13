/**
 * DASHBOARD THEME — Color Tokens
 * ─────────────────────────────────────────────────────────
 * Copy this file into any React project.
 * Import: import { COLORS, PIE_COLORS, USER_COLORS } from './theme/colors'
 */

/** Core UI color palette
 *  text / secondary / border use CSS custom properties so they
 *  respond automatically to <html class="dark"> toggled by ThemeContext.
 *  Chart-only accent colors stay as fixed hex values.
 */
export const COLORS = {
  primary:   '#2563EB',  // Blue-600 — buttons, active states, KPI accents
  teal:      '#10B981',  // Emerald-500 — success, upload actions
  amber:     '#F59E0B',  // Amber-400 — warnings, highlights
  indigo:    '#6366F1',  // Indigo-500 — analytics, charts
  text:      'var(--dash-text, #111827)',       // flips in dark mode
  secondary: 'var(--dash-secondary, #4B5563)',  // flips in dark mode
  border:    'var(--dash-border, #E5E7EB)',     // flips in dark mode
  tooltipBg: '#111827',  // fixed dark background for chart tooltips
}

/** Sidebar & layout chrome */
export const LAYOUT = {
  sidebarBg: '#111827',                           // Dark navy sidebar
  pageBg:    'var(--dash-page-bg, #F8FAFC)',       // flips in dark mode
  headerBg:  'var(--dash-header-bg, #FFFFFF)',      // flips in dark mode
}

/** Pie / donut chart fill sequence */
export const PIE_COLORS = [
  COLORS.primary,
  COLORS.teal,
  COLORS.amber,
  COLORS.indigo,
  '#EC4899',  // Pink-500
  '#06B6D4',  // Cyan-500
]

/** Per-user / per-series chart color sequence (up to 10 distinct users) */
export const USER_COLORS = [
  '#2563EB',  // Blue
  '#10B981',  // Emerald
  '#F59E0B',  // Amber
  '#6366F1',  // Indigo
  '#EC4899',  // Pink
  '#06B6D4',  // Cyan
  '#8B5CF6',  // Violet
  '#EF4444',  // Red
  '#14B8A6',  // Teal
  '#F97316',  // Orange
]

/**
 * Returns the nth USER_COLORS entry, cycling if index > 9.
 * @param {number} index
 * @returns {string} hex color
 */
export function userColor(index) {
  return USER_COLORS[index % USER_COLORS.length]
}

/**
 * Returns a transparent tint of a hex color.
 * @param {string} hex  e.g. '#2563EB'
 * @param {number} opacity  0–1
 * @returns {string}  e.g. '#2563EB1A'
 */
export function colorWithOpacity(hex, opacity) {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0')
  return `${hex}${alpha}`
}
