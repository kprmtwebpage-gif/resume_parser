// DEPRECATED: Email verification component removed
// Using simple admin authentication instead
// This file is kept for backward compatibility only

export default function VerifyEmail({ onBackClick }) {
  return (
    <div>
      <p>This component is deprecated. Please use the admin login instead.</p>
      <button onClick={() => onBackClick?.()}>Back</button>
    </div>
  )
}

