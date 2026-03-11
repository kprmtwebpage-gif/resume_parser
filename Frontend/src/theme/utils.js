/**
 * DASHBOARD THEME — Shared Utilities
 * ─────────────────────────────────────────────────────────
 * Pure helper functions — no React dependencies, no side-effects.
 * Safe to use in Node.js, tests, or any framework.
 *
 * Import: import { timeAgo, formatDate } from './theme/utils'
 */

/**
 * Returns a human-readable "time ago" string for a date string.
 * @param {string|null} dateStr  ISO date string
 * @returns {string}  e.g. "3h ago", "2d ago", "Never"
 */
export function timeAgo(dateStr) {
  if (!dateStr) return 'Never'
  // Postgres returns UTC timestamps without 'Z'; append it so the browser
  // doesn't misinterpret them as local time (causes ~5.5h offset in IST).
  const normalized = (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) ? dateStr + 'Z' : dateStr
  const diff = Date.now() - new Date(normalized).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Formats a date string for chart X-axis labels based on the active period.
 * @param {string} v      ISO date string
 * @param {'daily'|'weekly'|'monthly'|'yearly'} period
 * @returns {string}  formatted label, e.g. "Jan 5", "W3", "Mar '26", "2025"
 */
export function formatDate(v, period) {
  const d = new Date(v)
  if (period === 'daily')   return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (period === 'weekly') {
    const startOfYear = new Date(d.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `W${weekNum}`
  }
  if (period === 'monthly') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  if (period === 'yearly')  return d.getFullYear().toString()
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for N days ago from now.
 * @param {number} daysAgo
 * @returns {string}
 */
export function dateNDaysAgo(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0]
}

/**
 * Computes a percentage trend between two values.
 * Returns 0 if previous is 0 to avoid division by zero.
 * @param {number} current
 * @param {number} previous
 * @returns {number}  rounded to 1 decimal, e.g. 12.3 means +12.3%
 */
export function trendPercent(current, previous) {
  if (!previous) return 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/**
 * Clamps a number between min and max.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
