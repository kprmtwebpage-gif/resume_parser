import { useEffect, useMemo, useRef, useState } from 'react'
import ReactQuill, { Quill } from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

/* ── Register custom undo / redo icons in Quill's icon registry ── */
if (typeof Quill !== 'undefined') {
  const icons = Quill.import('ui/icons')
  icons['undo'] =
    `<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path class="ql-stroke" d="M2.5 7.5H10a5 5 0 0 1 0 10H5"/>
      <polyline class="ql-stroke" points="2.5 3.5 2.5 7.5 6.5 7.5"/>
    </svg>`
  icons['redo'] =
    `<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path class="ql-stroke" d="M15.5 7.5H8a5 5 0 0 0 0 10h5"/>
      <polyline class="ql-stroke" points="15.5 3.5 15.5 7.5 11.5 7.5"/>
    </svg>`
}

/**
 * Allowed formats for the editor.
 */
const formats = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'align',
  'list',
  'bullet',
  'link',
  'image',
]

/**
 * Rich-text editor powered by React Quill.
 *
 * Props:
 *  - value        : HTML string
 *  - onChange      : (html: string) => void
 *  - placeholder   : placeholder text
 *  - readOnly      : if true, disable editing + hide toolbar
 */
export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Add your content here...',
  readOnly = false,
}) {
  const quillRef = useRef(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  /* ── Safe accessor – getEditor() throws if called before mount ── */
  const getEditor = () => {
    try { return quillRef.current?.getEditor() }
    catch { return null }
  }

  /**
   * ReactQuill fires onChange with source='api' during initialization
   * (before the value prop is applied), which would reset the parent's
   * jobDescription state to ''. We only forward source='user' events
   * (real typing / formatting) to the parent.
   *
   * Programmatic mutations (image insert, link insert) manually call
   * onChange after the operation so parent state stays correct.
   */
  const handleChange = (html, _delta, source) => {
    if (source !== 'user') return
    if (onChange) onChange(html)
  }

  /* ── Undo / Redo handlers ── */
  const undoHandler = () => {
    getEditor()?.history.undo()
  }
  const redoHandler = () => {
    getEditor()?.history.redo()
  }

  /* ── Image handler – embeds base64 data directly ── */
  const imageHandler = () => {
    const input = document.createElement('input')
    input.setAttribute('type', 'file')
    input.setAttribute('accept', 'image/*')
    input.click()

    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        const quill = getEditor()
        if (!quill) return
        const range = quill.getSelection(true)
        quill.insertEmbed(range ? range.index : 0, 'image', reader.result)
        // insertEmbed fires source='api', which handleChange ignores.
        // Manually propagate the updated HTML to the parent.
        if (onChange) onChange(quill.root.innerHTML)
      }
      reader.readAsDataURL(file)
    }
  }

  /* ── Link handler – opens custom modal ── */
  const linkHandler = () => {
    const editor = getEditor()
    if (!editor) return
    const range = editor.getSelection()
    const selectedText =
      range && range.length > 0 ? editor.getText(range.index, range.length) : ''
    setLinkText(selectedText.trim())
    setLinkUrl('')
    setShowLinkModal(true)
  }

  /* ── Toolbar modules ── */
  const modules = useMemo(
    () => ({
      toolbar: readOnly
        ? false
        : {
            container: [
              ['undo', 'redo'],
              [{ header: [1, 2, 3, 4, 5, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ color: [] }],
              [{ align: [] }],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link', 'image'],
            ],
            handlers: {
              undo: undoHandler,
              redo: redoHandler,
              image: imageHandler,
              link: linkHandler,
            },
          },
      history: { delay: 500, maxStack: 100, userOnly: true },
      clipboard: { matchVisual: false },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readOnly],
  )

  /* ── Image click → show delete overlay ── */
  useEffect(() => {
    const quill = getEditor()
    if (!quill || readOnly) return

    const editorRoot = quill.root

    let currentOverlay = null

    const removeOverlay = () => {
      currentOverlay?.remove()
      currentOverlay = null
    }

    const handleImgClick = (e) => {
      const img = e.target
      if (img.tagName !== 'IMG') {
        removeOverlay()
        return
      }

      // Dismiss any existing overlay first
      removeOverlay()

      // Position the delete button relative to the img element
      const wrapper = document.createElement('span')
      wrapper.style.cssText =
        'position:absolute;top:0;left:0;pointer-events:none;'
      // We'll use a fixed overlay positioned over the image
      const rect = img.getBoundingClientRect()
      const editorRect = editorRoot.getBoundingClientRect()

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.innerHTML = '&times;'
      btn.title = 'Delete image'
      btn.style.cssText = [
        'position:fixed',
        `top:${rect.top - 10}px`,
        `left:${rect.right - 10}px`,
        'width:22px',
        'height:22px',
        'line-height:18px',
        'text-align:center',
        'font-size:16px',
        'font-weight:bold',
        'background:#ef4444',
        'color:#fff',
        'border:none',
        'border-radius:50%',
        'cursor:pointer',
        'z-index:9999',
        'pointer-events:all',
        'padding:0',
      ].join(';')

      btn.onmousedown = (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        img.remove()
        removeOverlay()
        if (onChange) onChange(quill.root.innerHTML)
      }

      document.body.appendChild(btn)
      currentOverlay = btn

      // Auto-dismiss if user clicks elsewhere
      const onOutside = (ev) => {
        if (ev.target !== img && ev.target !== btn) {
          removeOverlay()
          document.removeEventListener('mousedown', onOutside)
        }
      }
      document.addEventListener('mousedown', onOutside)
    }

    editorRoot.addEventListener('click', handleImgClick)

    return () => {
      editorRoot.removeEventListener('click', handleImgClick)
      removeOverlay()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  return (
    <div className={`quill-rte-wrapper${readOnly ? ' quill-rte--readonly' : ''}`}>
      <style>{`
        .ql-toolbar .ql-undo svg,
        .ql-toolbar .ql-redo svg {
          width: 18px;
          height: 18px;
        }
        .ql-editor img {
          max-width: 100%;
          height: auto;
          cursor: pointer;
        }
      `}</style>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
      />
      {showLinkModal && (
        <div className="rte-link-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="rte-link-dialog" onClick={(e) => e.stopPropagation()}>
            <h4 className="rte-link-title">Add link</h4>
            <label className="rte-link-label">Text</label>
            <input
              className="rte-link-input"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Displayed text"
            />
            <label className="rte-link-label">URL</label>
            <input
              className="rte-link-input"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <div className="rte-link-actions">
              <button type="button" className="cjm-btn-cancel" onClick={() => setShowLinkModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cjm-btn-submit"
                onClick={() => {
                  const editor = getEditor()
                  if (!editor) return
                  const url = linkUrl?.trim()
                  if (!url) return
                  const range = editor.getSelection(true) || { index: editor.getLength(), length: 0 }
                  const text = linkText?.trim() || url
                  editor.deleteText(range.index, range.length)
                  editor.insertText(range.index, text, 'link', url)
                  editor.formatText(range.index, text.length, { link: url })
                  // insertText/formatText fire source='api', which handleChange filters out.
                  // Manually propagate the updated HTML to the parent.
                  if (onChange) onChange(editor.root.innerHTML)
                  setShowLinkModal(false)
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
