import { useState, useRef, useEffect, useCallback } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import './TagInput.css'

/**
 * TagInput - Multi-select tag input with autocomplete (SignalHire style)
 *
 * Props:
 *  - tags           : string[] — current selected tags
 *  - onChange       : (tags: string[]) => void
 *  - suggestions    : string[] — available suggestions
 *  - placeholder    : input placeholder
 *  - maxTags        : max number of tags (optional)
 *  - label          : optional label text
 *  - required       : mark field as required
 *  - name           : input name attribute
 *  - readOnly       : if true, only show tags without input
 */
export default function TagInput({
  tags = [],
  onChange,
  suggestions = [],
  placeholder = 'Type to add...',
  maxTags,
  label,
  required = false,
  name,
  readOnly = false,
}) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Filter suggestions based on input and exclude already selected tags
  const filtered = inputValue
    ? suggestions.filter(
        (s) =>
          s.toLowerCase().includes(inputValue.toLowerCase()) &&
          !tags.some((tag) => tag.toLowerCase() === s.toLowerCase())
      )
    : suggestions.filter((s) => !tags.some((tag) => tag.toLowerCase() === s.toLowerCase()))

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.ti-item')
      if (items[activeIndex]) {
        items[activeIndex].scrollIntoView({ block: 'nearest' })
      }
    }
  }, [activeIndex])

  const addTag = useCallback(
    (value) => {
      const trimmed = value.trim()
      if (!trimmed) return
      
      // Check if already exists (case-insensitive)
      if (tags.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())) {
        setInputValue('')
        return
      }

      // Check max tags limit
      if (maxTags && tags.length >= maxTags) {
        alert(`Maximum ${maxTags} tags allowed`)
        return
      }

      const newTags = [...tags, trimmed]
      onChange(newTags)
      setInputValue('')
      setIsOpen(false)
      setActiveIndex(-1)
      
      // Focus back to input
      setTimeout(() => inputRef.current?.focus(), 10)
    },
    [tags, onChange, maxTags]
  )

  const removeTag = useCallback(
    (index) => {
      if (readOnly) return
      const newTags = tags.filter((_, i) => i !== index)
      onChange(newTags)
      inputRef.current?.focus()
    },
    [tags, onChange, readOnly]
  )

  const handleInputChange = (e) => {
    if (readOnly) return
    setInputValue(e.target.value)
    setIsOpen(true)
    setActiveIndex(-1)
  }

  const handleFocus = () => {
    if (readOnly) return
    setIsOpen(true)
  }

  const handleKeyDown = (e) => {
    if (readOnly) return

    // Handle backspace to remove last tag when input is empty
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      e.preventDefault()
      removeTag(tags.length - 1)
      return
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
        break
      case 'Enter':
      case ',':
        e.preventDefault()
        if (activeIndex >= 0 && filtered[activeIndex]) {
          addTag(filtered[activeIndex])
        } else if (inputValue.trim()) {
          addTag(inputValue)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        break
      default:
        break
    }
  }

  // Highlight matching substring
  const renderHighlight = (text) => {
    if (!inputValue) return text
    const idx = text.toLowerCase().indexOf(inputValue.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="ti-highlight">{text.slice(idx, idx + inputValue.length)}</span>
        {text.slice(idx + inputValue.length)}
      </>
    )
  }

  return (
    <div className="ti-wrapper" ref={wrapperRef}>
      <div className={`ti-container${readOnly ? ' ti-container--readonly' : ''}`}>
        {/* Render existing tags */}
        {tags.map((tag, index) => (
          <span key={index} className="ti-tag">
            {tag}
            {!readOnly && (
              <button
                type="button"
                className="ti-tag-remove"
                onClick={() => removeTag(index)}
                aria-label={`Remove ${tag}`}
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {/* Input field */}
        {!readOnly && (
          <input
            ref={inputRef}
            type="text"
            name={name}
            className="ti-input"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ''}
            required={required && tags.length === 0}
            autoComplete="off"
            disabled={maxTags && tags.length >= maxTags}
          />
        )}
      </div>

      {/* Dropdown suggestions */}
      {isOpen && !readOnly && filtered.length > 0 && (
        <ul className="ti-dropdown" ref={listRef} role="listbox">
          {filtered.map((item, idx) => (
            <li
              key={item}
              role="option"
              aria-selected={idx === activeIndex}
              className={`ti-item${idx === activeIndex ? ' ti-item--active' : ''}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault()
                addTag(item)
              }}
            >
              {renderHighlight(item)}
            </li>
          ))}
        </ul>
      )}

      {/* Empty state when no matches */}
      {isOpen && !readOnly && filtered.length === 0 && inputValue && (
        <ul className="ti-dropdown" ref={listRef}>
          <li className="ti-item ti-item--empty">
            Press Enter to add "{inputValue}"
          </li>
        </ul>
      )}
    </div>
  )
}
