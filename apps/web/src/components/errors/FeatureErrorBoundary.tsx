import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; errorKey: number }

// Wraps isolated UI sections — cart drawer, tracking map, payment form.
// Includes a retry button that resets the boundary and re-renders the child.
export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorKey: 0 }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {}

  retry(): void {
    this.setState((s) => ({ hasError: false, errorKey: s.errorKey + 1 }))
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600">This section failed to load.</p>
          <button
            className="mt-2 text-sm font-medium text-primary underline"
            onClick={() => this.retry()}
          >
            Tap to retry
          </button>
        </div>
      )
    }
    return <div key={this.state.errorKey}>{this.props.children}</div>
  }
}
