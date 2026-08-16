import { type ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  width?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  page?: number
  total?: number
  limit?: number
  onPageChange?: (page: number) => void
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = 'No records found',
  page = 1,
  total = 0,
  limit = 20,
  onPageChange,
  onRowClick,
}: Props<T>) {
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-gray-950/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400 ${col.width ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-4">
                      <div className="h-3.5 animate-pulse rounded-md bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.3} stroke="currentColor" className="h-6 w-6 text-gray-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
                    <p className="text-xs text-gray-400">Data will appear here once available</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-t border-gray-50 transition-colors duration-100 ${
                    i % 2 !== 0 ? 'bg-gray-50/40' : 'bg-white'
                  } ${onRowClick ? 'cursor-pointer hover:bg-orange-50/30' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-3.5 text-gray-700">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t border-gray-100 bg-white px-5 py-3.5">
          <p className="text-xs text-gray-400">
            Showing{' '}
            <span className="font-semibold text-gray-600">{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</span>
            {' '}of{' '}
            <span className="font-semibold text-gray-600">{total}</span>
            {' '}results
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="min-w-[52px] text-center text-xs font-medium text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
