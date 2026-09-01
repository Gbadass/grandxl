'use client'

import { useMemo, useState, type ReactNode } from 'react'

export interface Column<T> {
  key: string
  // Sprint 13 (S13-9): accept ReactNode so headers can carry controls
  // (e.g. a select-all checkbox for batch operations). Plain strings still work.
  header: ReactNode
  render: (row: T) => ReactNode
  width?: string
  // Sprint 13 (S13-16): opt-in sort. When true, the header becomes clickable
  // and cycles asc → desc → none. Requires `sortValue` — a rendered ReactNode
  // is opaque, so consumers spell out what the sortable value is.
  sortable?: boolean
  sortValue?: (row: T) => string | number | Date | null | undefined
  // S13-16: opt-in CSV export. Only columns with an `exportValue` end up in the
  // download. Keeps ReactNode-heavy columns (avatars, buttons) out by default.
  exportValue?: (row: T) => string | number | null | undefined
}

export interface SortState {
  key: string
  direction: 'asc' | 'desc'
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
  // S13-16
  defaultSort?: SortState                              // uncontrolled initial sort
  sortState?: SortState | null                         // controlled sort state
  onSortChange?: (sort: SortState | null) => void      // controlled sort callback
  exportable?: boolean                                 // show "Export CSV" button
  exportFilename?: string                              // base name (extension auto-added)
}

// ── Sort helpers ─────────────────────────────────────────────────────────────
function compareValues(a: unknown, b: unknown): number {
  const aNil = a == null
  const bNil = b == null
  if (aNil && bNil) return 0
  if (aNil) return 1       // nulls sort last regardless of direction
  if (bNil) return -1
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// ── CSV helpers ──────────────────────────────────────────────────────────────
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename: string, csv: string): void {
  // BOM prefix so Excel opens UTF-8 files without mangling non-ASCII (e.g. ₦).
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ── Component ────────────────────────────────────────────────────────────────
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
  defaultSort,
  sortState,
  onSortChange,
  exportable,
  exportFilename,
}: Props<T>) {
  const totalPages = Math.ceil(total / limit)

  // Sort state — controlled if sortState prop provided, else internal.
  const [internalSort, setInternalSort] = useState<SortState | null>(defaultSort ?? null)
  const isControlled = sortState !== undefined
  const currentSort = isControlled ? sortState : internalSort

  const anySortable = columns.some((c) => c.sortable && c.sortValue)
  const anyExportable = columns.some((c) => c.exportValue)

  function cycleSort(key: string) {
    let next: SortState | null
    if (!currentSort || currentSort.key !== key) {
      next = { key, direction: 'asc' }
    } else if (currentSort.direction === 'asc') {
      next = { key, direction: 'desc' }
    } else {
      next = null
    }
    if (isControlled) onSortChange?.(next)
    else setInternalSort(next)
  }

  // Only sort client-side when uncontrolled (parent's data is authoritative
  // when controlled — usually because parent is fetching pre-sorted from the server).
  const sortedData = useMemo(() => {
    if (isControlled || !currentSort) return data
    const col = columns.find((c) => c.key === currentSort.key)
    if (!col?.sortValue) return data
    const { direction } = currentSort
    const sorter = col.sortValue
    return [...data].sort((a, b) => {
      const cmp = compareValues(sorter(a), sorter(b))
      return direction === 'asc' ? cmp : -cmp
    })
  }, [data, columns, currentSort, isControlled])

  function handleExport() {
    const exportCols = columns.filter((c) => c.exportValue)
    if (exportCols.length === 0) return
    const header = exportCols
      .map((c) => escapeCsvCell(typeof c.header === 'string' ? c.header : c.key))
      .join(',')
    const rows = sortedData.map((row) =>
      exportCols
        .map((c) => escapeCsvCell(c.exportValue!(row)))
        .join(','),
    )
    const csv = [header, ...rows].join('\n')
    const base = (exportFilename ?? 'export').replace(/[^\w-]+/g, '-').toLowerCase()
    downloadCsv(`${base}-${todayIso()}.csv`, csv)
  }

  const showToolbar = exportable && anyExportable

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-gray-950/[0.03]">
      {showToolbar && (
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-5 py-2.5">
          <p className="text-[11px] font-medium text-gray-500">
            {sortedData.length} {sortedData.length === 1 ? 'row' : 'rows'}
            {total > sortedData.length && ` on this page · ${total} total`}
          </p>
          <button
            onClick={handleExport}
            disabled={sortedData.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Download the current view as a CSV file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Export CSV
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((col) => {
                const canSort = !!(col.sortable && col.sortValue)
                const isActiveSort = currentSort?.key === col.key
                const dir = isActiveSort ? currentSort!.direction : null
                return (
                  <th
                    key={col.key}
                    className={`px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400 ${col.width ?? ''} ${
                      canSort ? 'cursor-pointer select-none hover:text-gray-700' : ''
                    }`}
                    onClick={canSort ? () => cycleSort(col.key) : undefined}
                    aria-sort={
                      isActiveSort
                        ? dir === 'asc' ? 'ascending' : 'descending'
                        : canSort ? 'none' : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {canSort && (
                        <SortIndicator direction={dir} />
                      )}
                    </span>
                  </th>
                )
              })}
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
            ) : sortedData.length === 0 ? (
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
              sortedData.map((row, i) => (
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

      {/* Guarding against consumers who set exportable=true but forget to add
          exportValue to any column — silent no-op is confusing. This runs
          once during render; the console.warn is fine for dev feedback. */}
      {exportable && !anyExportable && typeof window !== 'undefined' && (
        <ExportWarning />
      )}
      {anySortable && null /* keep tree-shakers happy: reference used above */}
    </div>
  )
}

// Small dedicated component so the warn effect only runs once per mount,
// not every re-render.
function ExportWarning() {
  useMemo(() => {
    if (typeof console !== 'undefined') {
      console.warn('[DataTable] exportable=true but no columns have exportValue — export button will be hidden.')
    }
  }, [])
  return null
}

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (direction === 'asc') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3 text-gray-700">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
    )
  }
  if (direction === 'desc') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3 text-gray-700">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-3 w-3 text-gray-300">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
  )
}
