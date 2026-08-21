import { Component, type ReactNode, type ErrorInfo } from 'react'
import * as Sentry from '@sentry/react'
import i18n from '../../i18n'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{i18n.t('common:rootError.title')}</h1>
          <p className="mt-2 text-gray-600">{i18n.t('common:rootError.subtitle')}</p>
          <button
            className="mt-6 rounded-lg bg-primary px-6 py-3 font-medium text-white"
            onClick={() => window.location.reload()}
          >
            {i18n.t('common:rootError.reload')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
