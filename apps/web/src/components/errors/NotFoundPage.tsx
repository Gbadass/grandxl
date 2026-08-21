import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '../../router/routes'

export default function NotFoundPage() {
  const { t } = useTranslation('common')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <p className="mt-4 text-xl font-semibold text-gray-800">{t('notFound.title')}</p>
      <p className="mt-2 text-gray-500">{t('notFound.subtitle')}</p>
      <Link
        to={ROUTES.HOME}
        className="mt-6 rounded-lg bg-primary px-6 py-3 font-medium text-white"
      >
        {t('notFound.backToHome')}
      </Link>
    </div>
  )
}
