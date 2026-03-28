import { useEffect, useRef } from 'react'

const ITEMS = [
  { type: 'item', icon: '↑', label: 'Insert row above', cmd: 'addRowBefore' },
  { type: 'item', icon: '↓', label: 'Insert row below', cmd: 'addRowAfter' },
  { type: 'divider' },
  { type: 'item', icon: '←', label: 'Insert column left', cmd: 'addColumnBefore' },
  { type: 'item', icon: '→', label: 'Insert column right', cmd: 'addColumnAfter' },
  { type: 'divider' },
  { type: 'item', icon: '⊟', label: 'Delete row', cmd: 'deleteRow' },
  { type: 'item', icon: '⊟', label: 'Delete column', cmd: 'deleteColumn' },
  { type: 'item', icon: '✕', label: 'Delete table', cmd: 'deleteTable' },
  { type: 'divider' },
  { type: 'item', icon: '⊞', label: 'Merge cells', cmd: 'mergeCells' },
  { type: 'item', icon: '⊟', label: 'Split cell', cmd: 'splitCell' },
  { type: 'divider' },
  { type: 'item', icon: '☐', label: 'Toggle header row', cmd: 'toggleHeaderRow' },
  { type: 'item', icon: '☐', label: 'Toggle header column', cmd: 'toggleHeaderColumn' },
]

/**
 * Right-click context menu for table operations.
 * Shows near cursor position. Runs TipTap commands.
 */
export default function TableContextMenu({ x, y, editor, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const keyHandler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  const run = (cmd) => {
    editor.chain().focus()[cmd]().run()
    onClose()
  }

  const canRun = (cmd) => {
    try { return editor.can()[cmd]() } catch { return false }
  }

  // Clamp position so menu doesn't go off-screen
  const style = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 400),
  }

  return (
    <div className="word-context-menu" ref={ref} style={style}>
      {ITEMS.map((item, i) => {
        if (item.type === 'divider') return <div key={i} className="word-context-menu-divider" />
        const disabled = !canRun(item.cmd)
        return (
          <div
            key={i}
            className={`word-context-menu-item${disabled ? ' disabled' : ''}`}
            onClick={() => !disabled && run(item.cmd)}
          >
            <span className="word-context-menu-icon">{item.icon}</span>
            {item.label}
          </div>
        )
      })}
    </div>
  )
}
