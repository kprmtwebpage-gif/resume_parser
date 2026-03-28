import { TableCell } from '@tiptap/extension-table-cell'

/**
 * Custom TableCell extension that supports a backgroundColor attribute.
 * This allows cell‑level shading just like MS Word.
 */
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => {
          if (!attrs.backgroundColor) return {}
          return { style: `background-color: ${attrs.backgroundColor}` }
        },
      },
    }
  },
})

export default CustomTableCell
