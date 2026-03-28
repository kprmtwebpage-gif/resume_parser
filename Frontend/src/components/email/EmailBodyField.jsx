/**
 * EmailBodyField — Rich email body editor with 3 modes.
 *
 * Modes:
 *   • "edit"    — TipTap WYSIWYG editor (Word-like toolbar, tables, colors)
 *   • "html"    — Raw HTML <textarea> for direct source editing
 *   • "preview" — iframe rendering of prepareEmailHtml(value) — EXACTLY what's sent
 *
 * This replaces the previous Preview + Edit HTML–only component with a full
 * Word-like editing experience while preserving Gmail/Outlook-safe output.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import CustomTableCell from '../editor/extensions/CustomTableCell'
import EditorToolbar from '../editor/EditorToolbar'
import TableContextMenu from '../editor/TableContextMenu'
import { prepareEmailHtml } from '../../services/emailHtmlUtils'
import '../editor/WordEditor.css'

const EMPTY_PLACEHOLDER_DOC = (text) =>
  `<html><body style="margin:24px;font-family:Arial,Helvetica,sans-serif;color:#94a3b8;display:flex;align-items:center;justify-content:center;min-height:200px;"><p style="text-align:center;margin:0;">${text}</p></body></html>`

export default function EmailBodyField({
  value,
  onChange,
  placeholder = 'Compose your email...',
}) {
  const [mode, setMode] = useState('edit')
  const [contextMenu, setContextMenu] = useState(null)
  // Track whether last change came from editor to avoid re-setting content
  const internalChange = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true, lastColumnResizable: true }),
      TableRow,
      TableHeader,
      CustomTableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      internalChange.current = true
      onChange?.(html)
    },
  })

  // Sync external value changes (e.g. template loaded, HTML edit) into TipTap
  useEffect(() => {
    if (!editor) return
    if (internalChange.current) {
      internalChange.current = false
      return
    }
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])

  // Context menu for table right-click
  const handleContextMenu = useCallback((e) => {
    if (!editor) return
    const cell = e.target.closest('td, th')
    if (!cell) { setContextMenu(null); return }
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [editor])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // Mode switching: when leaving "html" mode, sync textarea → editor
  const switchMode = useCallback((newMode) => {
    setMode(newMode)
  }, [])

  // Processed HTML for preview
  const processedHtml = value && value.trim() ? prepareEmailHtml(value) : null

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
      {/* ── Mode Toggle Bar ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: '6px 12px', borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#fafbfc',
      }}>
        <div style={{
          display: 'flex', gap: '2px',
          backgroundColor: '#e2e8f0', borderRadius: '6px', padding: '2px',
        }}>
          {[
            { id: 'edit', label: '✏️ Editor' },
            { id: 'html', label: '</> HTML' },
            { id: 'preview', label: '👁 Preview' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => switchMode(id)}
              style={{
                padding: '4px 12px', fontSize: '11px', fontWeight: 600,
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                backgroundColor: mode === id ? '#2563eb' : 'transparent',
                color: mode === id ? '#fff' : '#475569',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Safe badge */}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
          ✓ Gmail &amp; Outlook safe
        </span>
      </div>

      {/* ── Editor Mode: TipTap WYSIWYG ────────────────────── */}
      {mode === 'edit' && (
        <div className="email-editor-wrapper">
          <EditorToolbar editor={editor} />
          <div
            className="email-editor-content"
            onContextMenu={handleContextMenu}
          >
            <EditorContent editor={editor} />
          </div>
          {contextMenu && editor && (
            <TableContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              editor={editor}
              onClose={closeContextMenu}
            />
          )}
        </div>
      )}

      {/* ── HTML Mode: Raw Textarea ────────────────────────── */}
      {mode === 'html' && (
        <textarea
          value={value || ''}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            width: '100%',
            height: '400px',
            border: 'none',
            padding: '16px',
            fontSize: '12px',
            fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            color: '#1e293b',
            backgroundColor: '#f8fafc',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            lineHeight: 1.6,
          }}
        />
      )}

      {/* ── Preview Mode: Email-safe iframe ────────────────── */}
      {mode === 'preview' && (
        processedHtml ? (
          <iframe
            srcDoc={processedHtml}
            style={{ width: '100%', height: '400px', border: 'none', display: 'block' }}
            sandbox="allow-same-origin"
            title="Email preview — matches exactly what is sent"
          />
        ) : (
          <iframe
            srcDoc={EMPTY_PLACEHOLDER_DOC(placeholder)}
            style={{ width: '100%', height: '400px', border: 'none', display: 'block' }}
            sandbox="allow-same-origin"
            title="Email preview placeholder"
          />
        )
      )}

      {/* ── Scoped editor styles ───────────────────────────── */}
      <style>{`
        .email-editor-wrapper {
          display: flex;
          flex-direction: column;
        }
        .email-editor-content {
          padding: 16px 20px;
          min-height: 340px;
          max-height: 500px;
          overflow-y: auto;
          background: #fff;
          cursor: text;
        }
        .email-editor-content .tiptap {
          outline: none;
          min-height: 300px;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #1e293b;
        }
        .email-editor-content .tiptap:focus {
          outline: none;
        }
        .email-editor-content .tiptap p {
          margin: 0 0 8px 0;
        }
        .email-editor-content .tiptap h1 {
          font-size: 24px; font-weight: bold; margin: 0 0 10px 0;
        }
        .email-editor-content .tiptap h2 {
          font-size: 20px; font-weight: bold; margin: 0 0 8px 0;
        }
        .email-editor-content .tiptap h3 {
          font-size: 16px; font-weight: bold; margin: 0 0 6px 0;
        }
        .email-editor-content .tiptap table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
        }
        .email-editor-content .tiptap td,
        .email-editor-content .tiptap th {
          border: 1px solid #414141;
          padding: 6px 8px;
          position: relative;
          vertical-align: top;
          min-width: 40px;
        }
        .email-editor-content .tiptap th {
          font-weight: bold;
          background-color: #f0f0f0;
        }
        .email-editor-content .tiptap .selectedCell::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(55, 119, 255, 0.15);
          pointer-events: none;
          z-index: 2;
        }
        .email-editor-content .tiptap .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          cursor: col-resize;
          background-color: #3b82f6;
          z-index: 10;
        }
        .email-editor-content .tiptap .tableWrapper {
          overflow-x: auto;
        }
        .email-editor-content .tiptap.resize-cursor {
          cursor: col-resize;
        }
        .email-editor-content .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .email-editor-content .tiptap ul,
        .email-editor-content .tiptap ol {
          padding-left: 24px;
          margin: 4px 0;
        }
        .email-editor-content .tiptap li {
          line-height: 1.6;
        }
        .email-editor-content .tiptap a {
          color: #2563eb;
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}
