import { useState } from 'react'
import { Search, ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { useFilterStore } from '../../stores/filterStore'
import { useAppNames } from '../../hooks/useAppNames'
import { DateTimeInput } from '../ui/DateTimeInput'
import { useT } from '../../i18n/useT'
import clsx from 'clsx'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const STATUS_CODES = ['2xx', '3xx', '4xx', '5xx']

const AUTO_REFRESH_OPTIONS = [
  { ms: 0,     labelKey: 'refresh.off' as const },
  { ms: 1000,  labelKey: 'refresh.1s'  as const },
  { ms: 5000,  labelKey: 'refresh.5s'  as const },
  { ms: 10000, labelKey: 'refresh.10s' as const },
  { ms: 30000, labelKey: 'refresh.30s' as const },
  { ms: 60000, labelKey: 'refresh.60s' as const },
]

export function LogFilters() {
  const t = useT()
  const { filters, setFilters, resetFilters, autoRefreshInterval, setAutoRefreshInterval, triggerRefresh } = useFilterStore()
  const [expanded, setExpanded] = useState(false)
  const { data: appNames = [] } = useAppNames()

  const statusOptions = [
    { label: t('filters.statusAll'), value: '' },
    ...STATUS_CODES.map(v => ({ label: v, value: v })),
  ]

  const activeFilterCount = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== '').length

  return (
    <div className="card p-3">
      {/* Main filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* App name */}
        {appNames.length > 0 && (
          <select
            className="input w-44"
            value={filters.appName ?? ''}
            onChange={e => setFilters({ appName: e.target.value || undefined })}
          >
            <option value="">{t('filters.allApps')}</option>
            {appNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}

        {/* URL search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('filters.urlPlaceholder')}
            className="input pl-9"
            value={filters.url ?? ''}
            onChange={e => setFilters({ url: e.target.value || undefined })}
          />
        </div>

        {/* Method */}
        <select
          className="input w-36"
          value={filters.method ?? ''}
          onChange={e => setFilters({ method: e.target.value || undefined })}
        >
          <option value="">{t('filters.allMethods')}</option>
          {HTTP_METHODS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Status quick-filter */}
        <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilters({ statusCode: opt.value || undefined })}
              className={clsx(
                'px-3 py-2 text-xs font-medium transition-colors',
                (filters.statusCode ?? '') === opt.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Expand / Reset */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className={clsx('btn-secondary', activeFilterCount > 0 && 'ring-1 ring-brand-500')}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t('filters.advanced')}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {activeFilterCount > 0 && (
            <span className="bg-brand-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button onClick={resetFilters} className="btn-ghost gap-1">
            <RotateCcw className="w-3.5 h-3.5" />
            {t('filters.reset')}
          </button>
        )}

        <div className="flex-1" />

        {/* Refresh controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={triggerRefresh}
            className="btn-ghost p-2"
            title={t('refresh.refresh')}
            aria-label={t('refresh.refresh')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap select-none">
              {t('refresh.autoRefresh')}
            </span>
            <select
              className="input w-20 text-xs"
              value={autoRefreshInterval}
              onChange={e => setAutoRefreshInterval(Number(e.target.value))}
              title={t('refresh.autoRefresh')}
            >
              {AUTO_REFRESH_OPTIONS.map(opt => (
                <option key={opt.ms} value={opt.ms}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
          {autoRefreshInterval > 0 && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" title={t('refresh.autoRefresh')} />
          )}
        </div>
      </div>

      {/* Advanced filters */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">{t('filters.exactStatus')}</label>
            <input
              type="number"
              placeholder={t('filters.exactStatusPlaceholder')}
              className="input"
              value={filters.statusCode && /^\d+$/.test(filters.statusCode) ? filters.statusCode : ''}
              onChange={e => setFilters({ statusCode: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className="label">{t('filters.minDuration')}</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              className="input"
              value={filters.minProcessingTimeMs ?? ''}
              onChange={e => setFilters({ minProcessingTimeMs: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <label className="label">{t('filters.startTime')}</label>
            <DateTimeInput
              value={filters.startTime ?? ''}
              onChange={v => setFilters({ startTime: v })}
              placeholder={t('filters.startTimePlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('filters.endTime')}</label>
            <DateTimeInput
              value={filters.endTime ?? ''}
              onChange={v => setFilters({ endTime: v })}
              placeholder={t('filters.endTimePlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('filters.remoteIp')}</label>
            <input
              type="text"
              placeholder={t('filters.remoteIpPlaceholder')}
              className="input"
              value={filters.remoteAddr ?? ''}
              onChange={e => setFilters({ remoteAddr: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className="label">{t('filters.serverName')}</label>
            <input
              type="text"
              placeholder={t('filters.serverNamePlaceholder')}
              className="input"
              value={filters.serverName ?? ''}
              onChange={e => setFilters({ serverName: e.target.value || undefined })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
