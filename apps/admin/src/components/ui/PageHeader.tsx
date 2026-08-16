import { type ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
  border?: boolean
}

export function PageHeader({ title, subtitle, action, border = true }: Props) {
  return (
    <div
      className={`mb-7 flex items-start justify-between ${
        border ? 'border-b border-gray-200/80 pb-5' : ''
      }`}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="ml-6 flex-shrink-0">{action}</div>
      )}
    </div>
  )
}
