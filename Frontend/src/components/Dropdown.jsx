import { useState } from 'react'
import './Dropdown.css'

export default function Dropdown({
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  disabled = false
}) {
  const handleChange = (e) => {
    onChange({
      target: {
        name,
        value: e.target.value
      }
    })
  }

  return (
    <select
      name={name}
      value={value || ''}
      onChange={handleChange}
      disabled={disabled}
      className="dropdown-select"
    >
      <option value="">{placeholder}</option>
      {options.map((option, idx) => (
        <option key={idx} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
