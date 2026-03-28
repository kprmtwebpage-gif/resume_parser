import { useState, useRef, useEffect, useCallback } from 'react'
import TableGridPicker from './TableGridPicker'

/**
 * Color palette used for cell shading — matches Word's theme colors
 */
const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
  '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599',
  '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd', '#cc4125', '#e06666',
  '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
]

/**
 * Word-like toolbar for the TipTap editor.
 */
export default function EditorToolbar({ editor }) {
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [showCellColor, setShowCellColor] = useState(false)
  const [showFontColor, setShowFontColor] = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)
  const tablePickerRef = useRef(null)
  const cellColorRef = useRef(null)
  const fontColorRef = useRef(null)
  const highlightRef = useRef(null)

  if (!editor) return null

  const Btn = ({ active, onClick, title, children, disabled }) => (
    <button
      className={`word-toolbar-btn${active ? ' active' : ''}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  )

  const handleInsertTable = useCallback((rows, cols) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
  }, [editor])

  const applyCellBg = (color) => {
    editor.chain().focus().setCellAttribute('backgroundColor', color).run()
    setShowCellColor(false)
  }

  const applyFontColor = (color) => {
    editor.chain().focus().setColor(color).run()
    setShowFontColor(false)
  }

  const applyHighlight = (color) => {
    editor.chain().focus().toggleHighlight({ color }).run()
    setShowHighlight(false)
  }

  const isInTable = editor.isActive('table')

  return (
    <div className="word-toolbar">
      {/* ── Font formatting ── */}
      <div className="word-toolbar-group">
        <select
          className="word-toolbar-select"
          value={
            editor.isActive('heading', { level: 1 }) ? '1' :
            editor.isActive('heading', { level: 2 }) ? '2' :
            editor.isActive('heading', { level: 3 }) ? '3' : '0'
          }
          onChange={(e) => {
            const v = parseInt(e.target.value)
            if (v === 0) editor.chain().focus().setParagraph().run()
            else editor.chain().focus().toggleHeading({ level: v }).run()
          }}
          title="Heading level"
        >
          <option value="0">Normal</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>
      </div>

      {/* ── Bold / Italic / Underline / Strike ── */}
      <div className="word-toolbar-group">
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <strong>B</strong>
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <em>I</em>
        </Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </Btn>
        <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </Btn>
      </div>

      {/* ── Font color ── */}
      <div className="word-toolbar-group">
        <div className="word-toolbar-color-wrap" ref={fontColorRef}>
          <Btn onClick={() => { setShowFontColor(!showFontColor); setShowHighlight(false); setShowCellColor(false) }} title="Font Color">
            <span>A</span>
            <div className="word-toolbar-color-swatch" style={{ backgroundColor: '#ff0000' }} />
          </Btn>
          {showFontColor && (
            <div className="word-toolbar-color-popup">
              {COLORS.map((c) => (
                <div key={c} className="word-toolbar-color-cell" style={{ backgroundColor: c }}
                  onClick={() => applyFontColor(c)} title={c} />
              ))}
              <div className="word-toolbar-color-cell" style={{ background: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)', backgroundSize: '6px 6px' }}
                onClick={() => { editor.chain().focus().unsetColor().run(); setShowFontColor(false) }} title="Remove color" />
            </div>
          )}
        </div>

        <div className="word-toolbar-color-wrap" ref={highlightRef}>
          <Btn active={editor.isActive('highlight')} onClick={() => { setShowHighlight(!showHighlight); setShowFontColor(false); setShowCellColor(false) }} title="Highlight">
            <span style={{ background: '#ffff00', padding: '0 2px', fontSize: '12px' }}>ab</span>
          </Btn>
          {showHighlight && (
            <div className="word-toolbar-color-popup">
              {COLORS.map((c) => (
                <div key={c} className="word-toolbar-color-cell" style={{ backgroundColor: c }}
                  onClick={() => applyHighlight(c)} title={c} />
              ))}
              <div className="word-toolbar-color-cell" style={{ background: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)', backgroundSize: '6px 6px' }}
                onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlight(false) }} title="Remove highlight" />
            </div>
          )}
        </div>
      </div>

      {/* ── Alignment ── */}
      <div className="word-toolbar-group">
        <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left">
          ≡
        </Btn>
        <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Center">
          ≡
        </Btn>
        <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align Right">
          ≡
        </Btn>
      </div>

      {/* ── Lists ── */}
      <div className="word-toolbar-group">
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          •≡
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
          1.
        </Btn>
      </div>

      {/* ── Table insert ── */}
      <div className="word-toolbar-group" style={{ position: 'relative' }} ref={tablePickerRef}>
        <Btn onClick={() => { setShowTablePicker(!showTablePicker); setShowCellColor(false); setShowFontColor(false); setShowHighlight(false) }} title="Insert Table">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </Btn>
        {showTablePicker && (
          <TableGridPicker
            onInsert={handleInsertTable}
            onClose={() => setShowTablePicker(false)}
          />
        )}
      </div>

      {/* ── Table operations (shown when inside table) ── */}
      {isInTable && (
        <>
          <div className="word-toolbar-group">
            <Btn onClick={() => editor.chain().focus().addRowBefore().run()} title="Add row above">↑+</Btn>
            <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">↓+</Btn>
            <Btn onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add column left">←+</Btn>
            <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column right">→+</Btn>
          </div>

          <div className="word-toolbar-group">
            <Btn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">↑✕</Btn>
            <Btn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">←✕</Btn>
          </div>

          <div className="word-toolbar-group">
            <Btn onClick={() => editor.chain().focus().mergeCells().run()} title="Merge cells"
              disabled={!editor.can().mergeCells()}>⊞</Btn>
            <Btn onClick={() => editor.chain().focus().splitCell().run()} title="Split cell"
              disabled={!editor.can().splitCell()}>⊟</Btn>
          </div>

          {/* Cell shading color */}
          <div className="word-toolbar-group">
            <div className="word-toolbar-color-wrap" ref={cellColorRef}>
              <Btn onClick={() => { setShowCellColor(!showCellColor); setShowFontColor(false); setShowHighlight(false) }} title="Cell Shading">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <rect x="3" y="3" width="18" height="18" rx="1" fill="#ffd966" stroke="currentColor" />
                </svg>
              </Btn>
              {showCellColor && (
                <div className="word-toolbar-color-popup">
                  {COLORS.map((c) => (
                    <div key={c} className="word-toolbar-color-cell" style={{ backgroundColor: c }}
                      onClick={() => applyCellBg(c)} title={c} />
                  ))}
                  <div className="word-toolbar-color-cell" style={{ background: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)', backgroundSize: '6px 6px' }}
                    onClick={() => applyCellBg(null)} title="No Color" />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Undo / Redo ── */}
      <div className="word-toolbar-group" style={{ marginLeft: 'auto' }}>
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
          ↶
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
          ↷
        </Btn>
      </div>
    </div>
  )
}
