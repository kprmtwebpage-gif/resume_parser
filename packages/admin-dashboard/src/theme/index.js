/**
 * DASHBOARD THEME — Barrel Export
 * ─────────────────────────────────────────────────────────
 * Single import point for the entire theme module.
 *
 * Usage in any project file:
 *   import { COLORS, KPICard, PeriodToggle, timeAgo, formatDate } from '../../theme'
 *
 * This module is completely portable — copy the entire src/theme/ folder
 * into any React + TailwindCSS + Recharts + lucide-react project.
 *
 * Peer dependencies:
 *   react >= 18
 *   recharts >= 2
 *   lucide-react >= 0.300
 *   tailwindcss >= 3
 */

// Colors
export {
  COLORS,
  LAYOUT,
  PIE_COLORS,
  USER_COLORS,
  userColor,
  colorWithOpacity,
} from './colors'

// Typography
export {
  FONT_FAMILY,
  labelClasses,
  headingClasses,
  valueClasses,
  subtextClasses,
  tableHeaderClasses,
  labelStyle,
  headingStyle,
  valueStyle,
  subtextStyle,
} from './typography'

// Utility functions
export {
  timeAgo,
  formatDate,
  dateNDaysAgo,
  trendPercent,
  clamp,
} from './utils'

// Components
export {
  KPICard,
  TrendBadge,
  PeriodToggle,
  ChartTooltip,
  MultiSeriesChartTooltip,
  SectionDivider,
  StatusBadge,
  PageHeader,
  MiniSparkline,
  ChartCard,
} from './components'
