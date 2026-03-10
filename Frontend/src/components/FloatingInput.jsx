import { useState } from 'react'
import './FloatingInput.css'

/**
 * FloatingInput — Input with floating label animation
 * Label floats up when input has value or is focused
 *
 * Props:
 *  - label       : string (label text)
 *  - value       : string
 *  - onChange    : (e) => void
 *  - type        : string (default 'text')
 *  - name        : string
 *  - placeholder : string (optional, shown when focused)
 *  - list        : string (optional, datalist id for suggestions)
 *  - suggestions : string[] (optional, suggestions for datalist)
 */
export default function FloatingInput({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  name,
  placeholder = '',
  list,
  suggestions = []
}) {
  const [isFocused, setIsFocused] = useState(false)
  const hasValue = value && value.length > 0
  const isFloating = isFocused || hasValue

  return (
    <div className={`fi-wrapper ${isFloating ? 'fi-wrapper--floating' : ''}`}>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused ? placeholder : ''}
        className="fi-input"
        autoComplete="off"
        list={list}
      />
      <label className="fi-label">{label}</label>
      <div className="fi-border" />
      {list && suggestions.length > 0 && (
        <datalist id={list}>
          {suggestions.map((s, i) => (
            <option key={i} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}
