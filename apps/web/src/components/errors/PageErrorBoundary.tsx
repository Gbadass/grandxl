import { Component, type ReactNode, type ErrorInfo } from 'react'
import { ROUTES } from '../../router/routes'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Page-level errors are caught by RootErrorBoundary's Sentry handler
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
          <p className="text-lg font-semibold text-gray-800">Something went wrong on this page</p>
          <p className="mt-1 text-sm text-gray-500">The rest of the app is still working.</p>
          <a
            href={ROUTES.HOME}
            className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white"
          >
            Go home
          </a>
        </div>
      )
    }
    return this.props.children
  }
}
