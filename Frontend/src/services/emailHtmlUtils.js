/**
 * emailHtmlUtils.js — Browser-safe email HTML processor.
 *
 * Equivalent of `juice` (CSS inliner) but implemented using the browser's
 * native DOMParser — zero external dependencies, Vite/ESM compatible.
 *
 * Ensures HTML from TipTap / Quill renders correctly in Gmail & Outlook by:
 *   - Preserving ALL existing inline styles (background-color, color, text-align, etc.)
 *   - Adding missing email-required attributes (cellpadding, cellspacing, border)
 *   - Injecting font-family on text blocks
 *   - Removing CSS class attributes (email clients ignore them)
 *   - Removing data-* attributes (TipTap artifacts)
 */

const FONT_BASE = 'font-family:Arial,Helvetica,sans-serif;font-size:14px;'

/**
 * Parse a style string into an object for easy manipulation.
 * e.g. "color:red; background-color:blue" → { color: 'red', 'background-color': 'blue' }
 */
function parseStyle(styleStr) {
  const result = {}
  if (!styleStr) return result
  styleStr.split(';').forEach(rule => {
    const idx = rule.indexOf(':')
    if (idx === -1) return
    const prop = rule.slice(0, idx).trim().toLowerCase()
    const val = rule.slice(idx + 1).trim()
    if (prop && val) result[prop] = val
  })
  return result
}

/**
 * Serialize a style object back to a string.
 */
function serializeStyle(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

/**
 * Merge base styles with element's existing styles.
 * Existing styles WIN over base styles (they are preserved as-is).
 */
function mergeStyles(base, existing) {
  return serializeStyle({ ...parseStyle(base), ...parseStyle(existing) })
}

/**
 * prepareEmailHtml(rawHtml)
 *
 * Takes raw HTML (from TipTap template or originalBodyRef) and returns a
 * fully inline-styled, email-client-safe HTML string.
 *
 * This should be called on the ORIGINAL template HTML (not Quill-rendered),
 * so all cell colors, text alignments, and custom styles are preserved.
 *
 * @param {string} rawHtml - The original HTML from the template editor
 * @returns {string} - Email-safe HTML with all styles inlined
 */
export function prepareEmailHtml(rawHtml) {
  if (!rawHtml || !rawHtml.trim()) return rawHtml || ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(rawHtml, 'text/html')
  const body = doc.body

  // ── Remove TipTap artifact wrappers ────────────────────────────────
  body.querySelectorAll('div.tableWrapper').forEach(wrapper => {
    wrapper.replaceWith(...wrapper.childNodes)
  })

  // ── Remove colgroup (Gmail ignores, adds noise) ─────────────────────
  body.querySelectorAll('colgroup').forEach(cg => cg.remove())

  // ── Remove class and data-* attributes (email clients ignore them) ──
  body.querySelectorAll('*').forEach(el => {
    el.removeAttribute('class')
    Array.from(el.attributes)
      .filter(a => a.name.startsWith('data-'))
      .forEach(a => el.removeAttribute(a.name))
  })

  // ── Tables ──────────────────────────────────────────────────────────
  body.querySelectorAll('table').forEach(table => {
    table.setAttribute('cellpadding', '8')
    table.setAttribute('cellspacing', '0')
    table.setAttribute('border', '1')
    // Also set width attribute for Outlook which ignores CSS width
    table.setAttribute('width', '100%')
    const existing = table.getAttribute('style') || ''
    // Remove table-layout:fixed (TipTap artifact) — causes tiny columns in email
    const cleaned = existing.replace(/table-layout\s*:\s*fixed\s*;?/gi, '')
    const base = `border-collapse:collapse;width:100%;${FONT_BASE}`
    table.setAttribute('style', mergeStyles(base, cleaned))
  })

  // ── TD: add border/padding but KEEP existing background-color, etc. ─
  body.querySelectorAll('td').forEach(td => {
    const existing = td.getAttribute('style') || ''
    // Remove min-width constraints from TipTap — email clients handle these poorly
    const cleaned = existing.replace(/min-width\s*:\s*\d+px\s*;?/gi, '')
    const base = `border:1px solid #000;padding:8px;word-break:break-word;vertical-align:top;`
    td.setAttribute('style', mergeStyles(base, cleaned))
  })

  // ── TH ──────────────────────────────────────────────────────────────
  body.querySelectorAll('th').forEach(th => {
    const existing = th.getAttribute('style') || ''
    const cleaned = existing.replace(/min-width\s*:\s*\d+px\s*;?/gi, '')
    const existingParsed = parseStyle(cleaned)
    const hasBg = 'background-color' in existingParsed
    const base = `border:1px solid #000;padding:8px;font-weight:bold;word-break:break-word;vertical-align:top;${hasBg ? '' : 'background-color:#f2f2f2;'}`
    th.setAttribute('style', mergeStyles(base, cleaned))
  })

  // ── Paragraphs: font + preserve text-align, color ───────────────────
  body.querySelectorAll('p').forEach(p => {
    const existing = p.getAttribute('style') || ''
    const base = `${FONT_BASE}margin:0 0 8px 0;line-height:1.6;`
    p.setAttribute('style', mergeStyles(base, existing))
  })

  // ── Headings ────────────────────────────────────────────────────────
  const headingSizes = { h1: '24px', h2: '20px', h3: '16px' }
  Object.entries(headingSizes).forEach(([tag, size]) => {
    body.querySelectorAll(tag).forEach(h => {
      const existing = h.getAttribute('style') || ''
      const base = `${FONT_BASE}font-size:${size};font-weight:bold;margin:0 0 10px 0;line-height:1.4;`
      h.setAttribute('style', mergeStyles(base, existing))
    })
  })

  // ── List items ──────────────────────────────────────────────────────
  body.querySelectorAll('li').forEach(li => {
    const existing = li.getAttribute('style') || ''
    if (!existing) li.setAttribute('style', `${FONT_BASE}line-height:1.6;`)
  })

  // ── Links ───────────────────────────────────────────────────────────
  body.querySelectorAll('a').forEach(a => {
    const existing = a.getAttribute('style') || ''
    if (!existing) a.setAttribute('style', 'color:#2563eb;text-decoration:underline;')
  })

  const innerHtml = body.innerHTML

  // Output clean HTML with no outer grey wrapper/card — full-width, white background.
  // Both preview and email render identically (no container box).
  const result = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:16px;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${innerHtml}</body>
</html>`

  // Debug: log final HTML in development mode
  if (import.meta.env?.DEV) {
    console.log('[emailHtmlUtils] prepareEmailHtml output (first 800 chars):', result.slice(0, 800))
  }

  return result
}
