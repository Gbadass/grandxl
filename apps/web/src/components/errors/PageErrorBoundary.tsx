import { Component, type ReactNode, type ErrorInfo } from 'react'
import * as Sentry from '@sentry/react'
import i18n from '../../i18n'
import { ROUTES } from '../../router/routes'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, {
      level: 'warning',
      tags: { boundary: 'page', path: window.location.pathname },
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
          <p className="text-lg font-semibold text-gray-800">{i18n.t('common:pageError.title')}</p>
          <p className="mt-1 text-sm text-gray-500">{i18n.t('common:pageError.subtitle')}</p>
          <a
            href={ROUTES.HOME}
            className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white"
          >
            {i18n.t('common:pageError.goHome')}
          </a>
        </div>
      )
    }
    return this.props.children
  }
}
