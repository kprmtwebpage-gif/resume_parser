import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-neutral-900">Page not found</h1>
        <p className="mt-3 text-neutral-600">The page you are looking for does not exist.</p>
        <Link to="/" className="mt-6 inline-block text-brand-500 hover:text-brand-600">
          Go to Home
        </Link>
      </div>
    </div>
  )
}
