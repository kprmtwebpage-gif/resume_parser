import { useState, useRef, useEffect } from 'react'
import './Autocomplete.css'

export default function Autocomplete({
  name,
  value,
  onChange,
  suggestions = [],
  placeholder = '',
  allowFreeText = false,
  highlightMatch = false,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState([])
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (value) {
      const filtered = suggestions.filter(item =>
        item.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredSuggestions(filtered)
    } else {
      setFilteredSuggestions(suggestions)
    }
  }, [value, suggestions])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target) && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    onChange({
      target: {
        name,
        value: e.target.value
      }
    })
    setIsOpen(true)
  }

  const handleSelectSuggestion = (suggestion) => {
    onChange({
      target: {
        name,
        value: suggestion
      }
    })
    setIsOpen(false)
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleInputBlur = () => {
    // Delay to allow click on dropdown to register
    setTimeout(() => {
      setIsOpen(false)
    }, 100)
  }

  const displaySuggestions = isOpen && filteredSuggestions.length > 0

  return (
    <div className="ac-wrapper">
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="ac-input"
        autoComplete="off"
      />
      {displaySuggestions && (
        <div ref={dropdownRef} className="ac-dropdown">
          {filteredSuggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className={`ac-item ${
                highlightMatch && value && suggestion.toLowerCase().includes(value.toLowerCase())
                  ? 'ac-highlight'
                  : ''
              }`}
              onMouseDown={() => handleSelectSuggestion(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
