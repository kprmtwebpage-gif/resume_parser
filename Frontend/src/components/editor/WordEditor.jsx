import { useCallback, useEffect, useState } from 'react'
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
import CustomTableCell from './extensions/CustomTableCell'
import EditorToolbar from './EditorToolbar'
import TableContextMenu from './TableContextMenu'
import './WordEditor.css'

const TEMPLATE_VARIABLES = [
  { key: 'candidate_name', label: 'Candidate Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'location', label: 'Location' },
  { key: 'experience', label: 'Experience' },
  { key: 'us_experience', label: 'US Experience' },
  { key: 'work_auth', label: 'Work Auth' },
  { key: 'visa_validity', label: 'Visa Validity' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'rate', label: 'Rate' },
  { key: 'education', label: 'Education' },
  { key: 'passport', label: 'Passport' },
  { key: 'availability', label: 'Availability' },
  { key: 'skills', label: 'Skills' },
  { key: 'willingness_to_relocate', label: 'Willingness to Relocate' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'ssn_last4', label: 'SSN Last 4' },
]

/**
 * WordEditor — a full Word‑like document editor built on TipTap.
 *
 * Props:
 *   content      — initial HTML content
 *   onUpdate     — (html: string) => void — called on every change
 *   placeholder  — placeholder text
 *   showVariables — show template variable chip bar (default: true)
 *   readOnly     — disable editing
 */
export default function WordEditor({
  content = '',
  onUpdate,
  placeholder = 'Start typing your document…',
  showVariables = true,
  readOnly = false,
}) {
  const [contextMenu, setContextMenu] = useState(null)

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
    content,
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getHTML())
    },
  })

  // Sync content prop changes
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML()
      // Only update if content is meaningfully different
      if (content !== currentContent) {
        editor.commands.setContent(content, false)
      }
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync readOnly
  useEffect(() => {
    if (editor) editor.setEditable(!readOnly)
  }, [readOnly, editor])

  // Context menu handler
  const handleContextMenu = useCallback((e) => {
    if (!editor) return
    // Only show custom menu when right-clicking inside a table
    const cell = e.target.closest('td, th')
    if (!cell) {
      setContextMenu(null)
      return
    }
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [editor])

  // Close context menu on outside click or scroll
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // Insert a template variable at cursor
  const insertVariable = useCallback((key) => {
    if (!editor) return
    editor.chain().focus().insertContent(`{{${key}}}`).run()
  }, [editor])

  // Character / word count
  const text = editor?.state?.doc?.textContent || ''
  const charCount = text.length
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <div className="word-editor-wrapper">
      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Variable chips */}
      {showVariables && !readOnly && (
        <div className="variable-chip-bar">
          <span style={{ fontSize: 11, color: '#666', marginRight: 4, alignSelf: 'center' }}>Variables:</span>
          {TEMPLATE_VARIABLES.map((v) => (
            <button key={v.key} className="variable-chip" onClick={() => insertVariable(v.key)}
              title={`Insert {{${v.key}}}`}>
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>
      )}

      {/* A4 page area */}
      <div className="word-editor-page-area">
        <div className="word-editor-page" onContextMenu={handleContextMenu}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Status bar */}
      <div className="word-status-bar">
        <span>{wordCount} words &nbsp;|&nbsp; {charCount} characters</span>
        <span>Page 1 of 1</span>
      </div>

      {/* Right‑click context menu */}
      {contextMenu && editor && (
        <TableContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          editor={editor}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
}
