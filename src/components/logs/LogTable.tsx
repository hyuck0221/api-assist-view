import { useState, Fragment } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import type { ApiLogEntry, SortConfig } from '../../types'
import { getStatusBadgeClass, getMethodBadgeClass } from '../../types'
import { useFilterStore } from '../../stores/filterStore'
import { LogDetail } from './LogDetail'
import { useMergedLogs } from '../../hooks/useLogs'
import { useT } from '../../i18n/useT'

function SortIcon({ field, sort }: { field: string; sort: SortConfig }) {
  if (sort.field !== field) return <ChevronsUpDown className="w-3 h-3 text-gray-400" />
  return sort.direction === 'asc'
    ? <ChevronUp className="w-3 h-3" />
    : <ChevronDown className="w-3 h-3" />
}

export function LogTable() {
  const t = useT()
  const { data, isFetching } = useMergedLogs()
  const { sort, setSort, page, setPage, pageSize, setPageSize } = useFilterStore()
  const [selectedEntry, setSelectedEntry] = useState<ApiLogEntry | null>(null)

  const entries = data?.content ?? []
  const totalElements = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0
  const sourceErrors = data?.perSourceErrors ?? []

  const COLUMNS = [
    { key: 'requestTime' as const,      label: t('table.colTime'),     sortable: true,  colWidth: '156px' },
    { key: 'appName' as const,          label: t('table.colApp'),      sortable: true,  colWidth: '112px' },
    { key: 'method' as const,           label: t('table.colMethod'),   sortable: true,  colWidth: '80px'  },
    { key: 'responseStatus' as const,   label: t('table.colStatus'),   sortable: true,  colWidth: '68px'  },
    { key: 'url' as const,              label: t('table.colUrl'),      sortable: true,  colWidth: undefined }, // flex
    { key: 'processingTimeMs' as const, label: t('table.colDuration'), sortable: true,  colWidth: '100px' },
    { key: 'remoteAddr' as const,       label: t('table.colRemoteIp'), sortable: false, colWidth: '136px' },
  ]

  function handleSort(field: keyof ApiLogEntry) {
    setSort({
      field,
      direction: sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc',
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Source errors */}
      {sourceErrors.map(e => (
        <div key={e.sourceId} className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span><strong>{e.sourceName}</strong>: {e.error}</span>
        </div>
      ))}

      {/* Table card */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              {COLUMNS.map(col => (
                <col key={col.key} style={col.colWidth ? { width: col.colWidth } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={clsx(
                      'px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden',
                      col.sortable && 'cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 select-none'
                    )}
                    onClick={() => col.sortable && handleSort(col.key as keyof ApiLogEntry)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <SortIcon field={col.key} sort={sort} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isFetching && entries.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-gray-400 dark:text-gray-600">
                    {t('table.empty')}
                  </td>
                </tr>
              ) : (
                entries.map(entry => {
                  const isSelected = selectedEntry?.id === entry.id && selectedEntry?._sourceId === entry._sourceId
                  return (
                    <Fragment key={`${entry._sourceId}-${entry.id}`}>
                      <LogRow
                        entry={entry}
                        isSelected={isSelected}
                        onClick={() => setSelectedEntry(isSelected ? null : entry)}
                      />
                      {isSelected && (
                        <tr>
                          <td colSpan={COLUMNS.length} className="p-0 border-b border-brand-200 dark:border-brand-800">
                            <LogDetail entry={entry} onClose={() => setSelectedEntry(null)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>{t('table.rowsPerPage')}</span>
            <select
              className="input w-20 py-1"
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
            >
              {[25, 50, 100, 200].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {totalElements > 0
                ? t('table.results', page * pageSize + 1, Math.min((page + 1) * pageSize, totalElements), totalElements.toLocaleString())
                : t('table.noResults')
              }
            </span>
            <button
              className="btn-ghost py-1 px-2"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              ←
            </button>
            <button
              className="btn-ghost py-1 px-2"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              →
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

function LogRow({
  entry,
  isSelected,
  onClick,
}: {
  entry: ApiLogEntry
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'cursor-pointer transition-colors',
        isSelected
          ? 'bg-brand-50 dark:bg-brand-950/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
      )}
    >
      {/* Time */}
      <td className="px-3 py-2 whitespace-nowrap overflow-hidden font-mono text-xs text-gray-600 dark:text-gray-400">
        {entry.requestTime ? format(new Date(entry.requestTime), 'MM-dd HH:mm:ss.SSS') : '-'}
      </td>
      {/* App */}
      <td className="px-3 py-2 overflow-hidden text-xs text-gray-700 dark:text-gray-300">
        <span className="truncate block" title={entry.appName ?? ''}>
          {entry.appName ?? <span className="text-gray-400">—</span>}
        </span>
      </td>
      {/* Method */}
      <td className="px-3 py-2 overflow-hidden">
        <span className={clsx('badge', getMethodBadgeClass(entry.method))}>{entry.method}</span>
      </td>
      {/* Status */}
      <td className="px-3 py-2 overflow-hidden">
        <span className={clsx('badge', getStatusBadgeClass(entry.responseStatus))}>{entry.responseStatus}</span>
      </td>
      {/* URL */}
      <td className="px-3 py-2 overflow-hidden">
        <span
          className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate block"
          title={entry.url + (entry.queryParams && Object.keys(entry.queryParams).length > 0
            ? '?' + Object.entries(entry.queryParams).map(([k, v]) => `${k}=${(v as string[]).join(',')}`).join('&')
            : '')}
        >
          {entry.url}
          {entry.queryParams && Object.keys(entry.queryParams).length > 0 && (
            <span className="text-gray-400 dark:text-gray-500">
              ?{Object.entries(entry.queryParams)
                .map(([k, v]) => `${k}=${(v as string[]).join(',')}`)
                .join('&')}
            </span>
          )}
        </span>
      </td>
      {/* Duration */}
      <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-right">
        {entry.processingTimeMs == null ? (
          <span className="font-mono text-xs text-gray-400">-</span>
        ) : (
          <span className={clsx(
            'font-mono text-xs',
            entry.processingTimeMs > 1000 ? 'text-red-600 dark:text-red-400 font-semibold'
              : entry.processingTimeMs > 500 ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-600 dark:text-gray-400'
          )}>
            {entry.processingTimeMs.toLocaleString()} ms
          </span>
        )}
      </td>
      {/* Remote IP */}
      <td className="px-3 py-2 overflow-hidden font-mono text-xs text-gray-500 dark:text-gray-500">
        <span className="truncate block" title={entry.remoteAddr ?? ''}>
          {entry.remoteAddr ?? '-'}
        </span>
      </td>
    </tr>
  )
}
