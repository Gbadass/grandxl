import { Link } from 'react-router-dom'
import { ROUTES } from '../../router/routes'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <p className="mt-4 text-xl font-semibold text-gray-800">Page not found</p>
      <p className="mt-2 text-gray-500">The page you're looking for doesn't exist.</p>
      <Link
        to={ROUTES.HOME}
        className="mt-6 rounded-lg bg-primary px-6 py-3 font-medium text-white"
      >
        Back to home
      </Link>
    </div>
  )
}
