import { useMemo, useRef } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import ImageResize from 'quill-image-resize-module-react';
import 'react-quill/dist/quill.snow.css';

if (typeof Quill !== 'undefined' && !Quill.imports['modules/imageResize']) {
  Quill.register('modules/imageResize', ImageResize);
}

const toolbarId = 'job-desc-toolbar';

const RichTextEditor = ({ value, onChange, disabled }) => {
  const quillRef = useRef(null);

  const modules = useMemo(() => ({
    toolbar: {
      container: `#${toolbarId}`,
      handlers: {
        undo: () => {
          const editor = quillRef.current?.getEditor();
          editor?.history.undo();
        },
        redo: () => {
          const editor = quillRef.current?.getEditor();
          editor?.history.redo();
        }
      }
    },
    history: { delay: 500, maxStack: 100, userOnly: true },
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar']
    }
  }), []);

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
    'image'
  ];

  return (
    <div className={`quill-editor ${disabled ? 'disabled' : ''}`}>
      <div id={toolbarId} className="custom-quill-toolbar ql-toolbar ql-snow">
        <button className="ql-undo" type="button" title="Undo" aria-label="Undo">
          <span aria-hidden="true">&larr;</span>
        </button>
        <button className="ql-redo" type="button" title="Redo" aria-label="Redo">
          <span aria-hidden="true">&rarr;</span>
        </button>
        <span className="ql-formats">
          <select className="ql-header" defaultValue="" title="Paragraph style" aria-label="Paragraph style">
            <option value="">Paragraph</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>
        </span>
        <span className="ql-formats">
          <button className="ql-bold" type="button" title="Bold" aria-label="Bold"></button>
          <button className="ql-italic" type="button" title="Italic" aria-label="Italic"></button>
          <button className="ql-underline" type="button" title="Underline" aria-label="Underline"></button>
          <button className="ql-strike" type="button" title="Strike-through" aria-label="Strike-through"></button>
        </span>
        <span className="ql-formats">
          <select className="ql-color" title="Text color" aria-label="Text color"></select>
        </span>
        <span className="ql-formats">
          <button className="ql-align" type="button" title="Align left" aria-label="Align left"></button>
          <button className="ql-align" type="button" value="center" title="Align center" aria-label="Align center"></button>
          <button className="ql-align" type="button" value="right" title="Align right" aria-label="Align right"></button>
        </span>
        <span className="ql-formats">
          <button className="ql-list" value="bullet" type="button" title="Bullet list" aria-label="Bullet list"></button>
          <button className="ql-list" value="ordered" type="button" title="Number list" aria-label="Number list"></button>
        </span>
        <span className="ql-formats">
          <button className="ql-link" type="button" title="Insert link" aria-label="Insert link"></button>
          <button className="ql-image" type="button" title="Insert image" aria-label="Insert image"></button>
        </span>
      </div>
      <ReactQuill
        ref={quillRef}
        value={value || ''}
        onChange={onChange}
        readOnly={disabled}
        modules={modules}
        formats={formats}
        placeholder="Add job description here..."
        theme="snow"
      />
    </div>
  );
};

export default RichTextEditor;
