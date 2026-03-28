import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Word‑style 10×10 grid picker for inserting a table.
 * Shows "rows × cols" label and highlights cells on hover.
 */
export default function TableGridPicker({ onInsert, onClose }) {
  const [hoverRow, setHoverRow] = useState(0)
  const [hoverCol, setHoverCol] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleClick = useCallback(() => {
    if (hoverRow > 0 && hoverCol > 0) {
      onInsert(hoverRow, hoverCol)
      onClose()
    }
  }, [hoverRow, hoverCol, onInsert, onClose])

  const cells = []
  for (let r = 1; r <= 10; r++) {
    for (let c = 1; c <= 10; c++) {
      cells.push(
        <div
          key={`${r}-${c}`}
          className={`table-grid-picker-cell${r <= hoverRow && c <= hoverCol ? ' highlighted' : ''}`}
          onMouseEnter={() => { setHoverRow(r); setHoverCol(c) }}
          onClick={handleClick}
        />
      )
    }
  }

  return (
    <div className="table-grid-picker" ref={ref}>
      <div className="table-grid-picker-label">
        {hoverRow > 0 && hoverCol > 0 ? `${hoverRow} × ${hoverCol} Table` : 'Insert Table'}
      </div>
      <div className="table-grid-picker-grid">{cells}</div>
    </div>
  )
}
