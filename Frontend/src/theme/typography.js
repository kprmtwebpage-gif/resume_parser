/**
 * DASHBOARD THEME — Typography Tokens
 * ─────────────────────────────────────────────────────────
 * Two ways to apply the type system:
 *   1. Tailwind classes via the exported string constants (labelClasses, etc.)
 *   2. React inline style objects via the exported style constants (labelStyle, etc.)
 *      Useful when Tailwind purging may strip dynamic classes.
 *
 * Import: import { labelClasses, headingStyle, FONT_FAMILY } from './theme/typography'
 */

/** Primary font stack — add Inter via Google Fonts or self-hosted for best results */
export const FONT_FAMILY = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif"

/* ───────────────────────────────────────────
   TAILWIND CLASS STRINGS
   Use directly in className=""
   ─────────────────────────────────────────── */

/** KPI label / section meta label — ALL CAPS, tight tracking, small */
export const labelClasses = 'text-[11px] font-medium tracking-wide uppercase'

/** Section & card headings — extrabold, tight tracking */
export const headingClasses = 'font-extrabold tracking-tight'

/** Large KPI value number */
export const valueClasses = 'text-[28px] font-extrabold tracking-tight'

/** Secondary / supporting body text */
export const subtextClasses = 'text-[12px] font-medium'

/** Table header cell */
export const tableHeaderClasses = 'text-[11px] font-medium tracking-wide uppercase'

/* ───────────────────────────────────────────
   INLINE STYLE OBJECTS
   Use as style={{...headingStyle}}
   ─────────────────────────────────────────── */

/**
 * Inline style for all KPI-style labels.
 * @param {string} [color='#4B5563']  text color
 */
export function labelStyle(color = 'var(--dash-secondary, #4B5563)') {
  return {
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color,
  }
}

/**
 * Inline style for section headings.
 * @param {string} [color='#111827']  text color
 */
export function headingStyle(color = 'var(--dash-text, #111827)') {
  return {
    fontFamily: FONT_FAMILY,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color,
  }
}

/**
 * Inline style for large KPI values.
 * @param {string} [color='#111827']  text color
 */
export function valueStyle(color = 'var(--dash-text, #111827)') {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: '28px',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color,
  }
}

/**
 * Inline style for secondary / supporting text.
 * @param {string} [color='#4B5563']  text color
 */
export function subtextStyle(color = 'var(--dash-secondary, #4B5563)') {
  return {
    fontSize: '12px',
    fontWeight: 500,
    color,
  }
}
