/**
 * DASHBOARD THEME — Reusable UI Components
 * ─────────────────────────────────────────────────────────
 * Drop-in React components that apply the dashboard design system.
 * Dependencies: react, lucide-react, recharts, tailwindcss
 *
 * Import: import { KPICard, PeriodToggle, ChartTooltip, TrendBadge } from './theme/components'
 */

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { COLORS } from './colors'
import { headingStyle, labelStyle, valueStyle, FONT_FAMILY } from './typography'

/* ═══════════════════════════════════════════════════════
   KPI CARD
   ═══════════════════════════════════════════════════════ */

/**
 * Standard KPI summary card used throughout the admin dashboard.
 *
 * @param {object}  props
 * @param {string}  props.label       - Card label (e.g. "Total Users")
 * @param {string|number} props.value - Primary metric value
 * @param {React.ElementType} props.icon  - Lucide icon component
 * @param {string}  props.bg          - Icon background color (e.g. '#EFF6FF')
 * @param {string}  props.iconColor   - Icon fill color
 * @param {number|null} [props.trend] - Trend percentage. null = hide trend badge.
 * @param {string}  [props.size='lg'] - 'lg' (28px value) | 'md' (22px value)
 *
 * @example
 * <KPICard label="Total Users" value={412} icon={Users}
 *   bg="#EFF6FF" iconColor="#2563EB" trend={12.5} />
 */
export function KPICard({ label, value, icon: Icon, bg, iconColor, trend, size = 'lg' }) {
  return (
    <div
      className="bg-white rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
      style={{ border: `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: bg }}
        >
          {Icon && <Icon className="h-5 w-5" style={{ color: iconColor }} />}
        </div>
        {trend !== null && trend !== undefined && (
          <TrendBadge value={trend} />
        )}
      </div>
      <p
        className="text-[11px] font-medium tracking-wide uppercase"
        style={labelStyle()}
      >
        {label}
      </p>
      <p
        className={`font-extrabold tracking-tight mt-1 ${size === 'lg' ? 'text-[28px]' : 'text-[22px]'}`}
        style={{ color: COLORS.text, fontFamily: FONT_FAMILY }}
      >
        {value}
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   TREND BADGE
   ═══════════════════════════════════════════════════════ */

/**
 * Green/red percentage badge with arrow icon.
 *
 * @param {object} props
 * @param {number} props.value    - Signed percentage (e.g. 12.5 → "+12.5%", -3.2 → "-3.2%")
 * @param {number} [props.digits=1]  - Decimal places
 *
 * @example
 * <TrendBadge value={8.3} />
 * <TrendBadge value={-4.1} />
 */
export function TrendBadge({ value, digits = 1 }) {
  const positive = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
        positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
      }`}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(digits)}%
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   PERIOD TOGGLE
   ═══════════════════════════════════════════════════════ */

/**
 * Pill-style toggle for chart time period selection.
 *
 * @param {object}   props
 * @param {string}   props.active     - Currently active period key
 * @param {function} props.onChange   - Called with new period key
 * @param {string[]} [props.periods]  - Override default period list
 *
 * @example
 * const [period, setPeriod] = useState('daily')
 * <PeriodToggle active={period} onChange={setPeriod} />
 */
export function PeriodToggle({ active, onChange, periods = ['daily', 'weekly', 'monthly', 'yearly'] }) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
      {periods.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-[11px] font-semibold rounded-md capitalize transition-all ${
            active === p
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   CHART TOOLTIP
   ═══════════════════════════════════════════════════════ */

/**
 * Dark-background tooltip for Recharts charts.
 * Attach via: <Tooltip content={<ChartTooltip />} />
 *
 * @example
 * <AreaChart data={data}>
 *   <Tooltip content={<ChartTooltip />} />
 *   <Area dataKey="uploads" name="Uploads" ... />
 * </AreaChart>
 */
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-xl border-0"
      style={{ backgroundColor: COLORS.tooltipBg }}
    >
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[12px] font-semibold text-white">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

/**
 * Dark-background tooltip for multi-series (per-user) charts.
 * Attach via: <Tooltip content={<MultiSeriesChartTooltip />} />
 * Includes a "Total" row summing all series.
 *
 * @example
 * <BarChart data={data}>
 *   <Tooltip content={<MultiSeriesChartTooltip />} />
 * </BarChart>
 */
export function MultiSeriesChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg px-4 py-3 shadow-xl border-0 min-w-[180px]"
      style={{ backgroundColor: COLORS.tooltipBg }}
    >
      <p className="text-[10px] text-gray-400 mb-2 font-medium">{payload[0]?.payload?.date || ''}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-[11px] text-gray-300">{p.name}</span>
          </div>
          <span className="text-[12px] font-semibold text-white tabular-nums">{p.value}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div
          className="flex items-center justify-between gap-4 mt-2 pt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="text-[10px] text-gray-400">Total</span>
          <span className="text-[12px] font-bold text-white tabular-nums">
            {payload.reduce((s, p) => s + (p.value || 0), 0)}
          </span>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SECTION DIVIDER
   ═══════════════════════════════════════════════════════ */

/**
 * Horizontal rule with a centered label. Visually separates
 * overview-level sections from detailed analytics sections.
 *
 * @param {object} props
 * @param {string} [props.label='Detailed Analytics']
 *
 * @example
 * <SectionDivider label="Detailed Analytics" />
 */
export function SectionDivider({ label = 'Detailed Analytics' }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      <span
        className="text-[11px] font-bold tracking-[0.12em] uppercase"
        style={{ color: COLORS.secondary, fontFamily: FONT_FAMILY }}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   STATUS BADGE
   ═══════════════════════════════════════════════════════ */

/**
 * Colored pill badge for role / status labels.
 *
 * @param {object} props
 * @param {string} props.value      - Display text (e.g. 'admin', 'user', 'active')
 * @param {'admin'|'user'|'active'|'inactive'|string} [props.variant]
 *   - Preset variants: 'admin' (blue), 'user' (green), 'active' (green),
 *     'inactive' (gray), 'warning' (amber). Defaults to blue for unknown values.
 *
 * @example
 * <StatusBadge value="admin" variant="admin" />
 * <StatusBadge value="Active" variant="active" />
 */
export function StatusBadge({ value, variant }) {
  const v = (variant || value || '').toLowerCase()
  const presets = {
    admin:    { bg: '#EFF6FF', color: COLORS.primary },
    user:     { bg: '#F0FDF4', color: COLORS.teal },
    active:   { bg: '#F0FDF4', color: COLORS.teal },
    inactive: { bg: '#F9FAFB', color: '#9CA3AF' },
    warning:  { bg: '#FFFBEB', color: COLORS.amber },
  }
  const { bg, color } = presets[v] || { bg: '#EFF6FF', color: COLORS.primary }
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize"
      style={{ backgroundColor: bg, color }}
    >
      {value}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   PAGE HEADER
   ═══════════════════════════════════════════════════════ */

/**
 * Standard admin page header — superscript label + bold title + description.
 *
 * @param {object} props
 * @param {string} props.preLabel    - Small ALL-CAPS label above the title (e.g. "Upload Metrics")
 * @param {string} props.title       - Main page title
 * @param {string} [props.description]  - Optional descriptor below title
 *
 * @example
 * <PageHeader
 *   preLabel="Upload Metrics"
 *   title="User Upload Performance"
 *   description="Track and compare upload activity across users over any time period"
 * />
 */
export function PageHeader({ preLabel, title, description }) {
  return (
    <div>
      {preLabel && (
        <p
          className="text-[11px] font-medium tracking-wide uppercase"
          style={labelStyle()}
        >
          {preLabel}
        </p>
      )}
      <h2
        className="text-2xl font-extrabold tracking-tight mt-0.5"
        style={headingStyle()}
      >
        {title}
      </h2>
      {description && (
        <p
          className="text-[11px] font-medium tracking-wide uppercase mt-1"
          style={labelStyle()}
        >
          {description}
        </p>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   MINI SPARKLINE
   ═══════════════════════════════════════════════════════ */

/**
 * Tiny inline area sparkline for use inside table rows.
 * Data must be an array of objects with a numeric 'v' property.
 *
 * @param {object}   props
 * @param {{ v: number }[]} props.data   - Array of { v } data points
 * @param {string}   [props.color]       - Stroke/fill color
 * @param {number}   [props.width=80]    - Container width in px
 * @param {number}   [props.height=28]   - Container height in px
 *
 * @example
 * const sparkData = last14Days.map(d => ({ v: d.uploads }))
 * <MiniSparkline data={sparkData} color="#10B981" />
 */
export function MiniSparkline({ data, color = COLORS.primary, width = 80, height = 28 }) {
  const gradId = `spark_${color.replace('#', '')}`
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   CHART SECTION CARD
   ═══════════════════════════════════════════════════════ */

/**
 * White rounded card used to wrap a chart with a title, subtitle, and optional controls.
 *
 * @param {object}       props
 * @param {string}       props.title      - Chart title
 * @param {string}       [props.subtitle] - Small subtitle below the title
 * @param {React.ReactNode} [props.controls] - Right-aligned slot for toggles/filters
 * @param {React.ReactNode} props.children  - Chart content
 * @param {string}       [props.accentColor] - Left border accent (optional)
 *
 * @example
 * <ChartCard title="Login Activity" subtitle="Last 90 days"
 *   controls={<PeriodToggle active={period} onChange={setPeriod} />}>
 *   <ResponsiveContainer>...</ResponsiveContainer>
 * </ChartCard>
 */
export function ChartCard({ title, subtitle, controls, children, accentColor }) {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${COLORS.border}`,
        ...(accentColor ? { borderLeft: `4px solid ${accentColor}` } : {}),
      }}
    >
      <div
        className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div>
          <h3
            className="text-[15px] font-extrabold tracking-tight"
            style={headingStyle()}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className="text-[11px] font-medium tracking-wide uppercase mt-0.5"
              style={labelStyle()}
            >
              {subtitle}
            </p>
          )}
        </div>
        {controls && <div>{controls}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
