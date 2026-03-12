import { useState, useEffect, useCallback, Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import { Search, Loader2, AlertCircle, BookOpen, ChevronLeft, ChevronRight, X, Copy, Check } from 'lucide-react'
import clsx from 'clsx'
import { useSourceStore, useApiDocsSources } from '../stores/sourceStore'
import { fetchApiDocs, fetchApiDocsCategories } from '../services/apiDocsService'
import type { ApiDocEntry, ApiDocsSource } from '../types'
import { getMethodBadgeClass } from '../types'
import { useT } from '../i18n/useT'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function ApiDocsPage() {
  const t = useT()
  const docsSources = useApiDocsSources()
  const selectedSourceIds = useSourceStore(s => s.selectedSourceIds)

  // Find which of the selected sources is an api-docs source
  const activeSourceId = docsSources.find(s => selectedSourceIds.includes(s.id))?.id ?? ''

  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const [entries, setEntries] = useState<ApiDocEntry[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ApiDocEntry | null>(null)

  const selectedSource: ApiDocsSource | undefined = docsSources.find(s => s.id === activeSourceId)

  const loadDocs = useCallback(async () => {
    if (!selectedSource) return
    setLoading(true)
    setError(null)
    setDisabled(false)
    try {
      const res = await fetchApiDocs(selectedSource, { keyword, category, method, page, size: pageSize })
      setEntries(res.content)
      setTotalElements(res.totalElements)
      setTotalPages(res.totalPages)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('404') || msg.includes('disabled')) {
        setDisabled(true)
      } else {
        setError(msg)
      }
      setEntries([])
      setTotalElements(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [selectedSource, keyword, category, method, page, pageSize])

  const loadCategories = useCallback(async () => {
    if (!selectedSource) return
    try {
      const cats = await fetchApiDocsCategories(selectedSource)
      setCategories(cats.filter(Boolean).sort())
    } catch (e) {
      console.error('Failed to load categories:', e)
      setCategories([])
    }
  }, [selectedSource])

  useEffect(() => {
    setPage(0)
    setSelectedEntry(null)
  }, [keyword, category, method, activeSourceId, pageSize])

  useEffect(() => {
    if (selectedSource) {
      loadDocs()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSourceId, keyword, category, method, page, pageSize])

  // Fetch categories when source changes
  useEffect(() => {
    if (selectedSource) {
      loadCategories()
    } else {
      setCategories([])
    }
  }, [selectedSource, loadCategories])

  const from = totalElements === 0 ? 0 : page * pageSize + 1
  const to = Math.min(page * pageSize + pageSize, totalElements)

  if (docsSources.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="card p-8 text-center">
          <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{t('apiDocs.noDocsSources')}</p>
          <NavLink to="/settings" className="btn-primary inline-flex">
            {t('apiDocs.goToSettings')}
          </NavLink>
        </div>
      </div>
    )
  }

  const COL_COUNT = 4

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Keyword search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9 w-full"
            placeholder={t('apiDocs.keywordPlaceholder')}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>

        {/* Category filter */}
        <select
          className="input w-auto"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">{t('apiDocs.allCategories')}</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Method filter */}
        <select
          className="input w-auto"
          value={method}
          onChange={e => setMethod(e.target.value)}
        >
          <option value="">{t('apiDocs.allMethods')}</option>
          {HTTP_METHODS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('apiDocs.loading')}
          </div>
        )}

        {!loading && disabled && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {t('apiDocs.disabled')}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {t('apiDocs.error')}: {error}
          </div>
        )}

        {!loading && !disabled && !error && entries.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600 text-sm">
            {t('apiDocs.empty')}
          </div>
        )}

        {!loading && !disabled && !error && entries.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400 w-[200px]">
                      {t('apiDocs.colCategory')}
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400 w-[200px]">
                      {t('apiDocs.colTitle')}
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400 w-[100px]">
                      {t('apiDocs.colMethod')}
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">
                      {t('apiDocs.colUrl')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {entries.map((entry) => {
                    const entryId = entry.id ?? `${entry.method}-${entry.url}`
                    const isSelected = selectedEntry?.id === entry.id && selectedEntry?.url === entry.url && selectedEntry?.method === entry.method
                    return (
                      <Fragment key={entryId}>
                        <tr
                          onClick={() => setSelectedEntry(isSelected ? null : entry)}
                          className={clsx(
                            'cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-brand-50 dark:bg-brand-950/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          )}
                        >
                          <td className="px-4 py-2.5">
                            {entry.category ? (
                              <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs truncate block" title={entry.category}>
                                {entry.category}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs truncate" title={entry.title ?? ''}>
                            {entry.title ?? '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={clsx('badge font-mono text-xs', getMethodBadgeClass(entry.method))}>
                              {entry.method}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <code className="text-xs font-mono text-gray-900 dark:text-gray-100 break-all line-clamp-1" title={entry.url}>
                              {entry.url}
                            </code>
                          </td>
                        </tr>
                        {isSelected && (
                          <tr>
                            <td colSpan={COL_COUNT} className="p-0 border-b border-brand-200 dark:border-brand-800">
                              <ApiDocDetail entry={entry} onClose={() => setSelectedEntry(null)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !disabled && !error && totalElements > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span>{t('apiDocs.rowsPerPage')}</span>
            <select
              className="input w-auto py-1 text-xs"
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs">
              {totalElements === 0
                ? t('apiDocs.noResults')
                : t('apiDocs.results', from, to, totalElements.toLocaleString())
              }
            </span>
            <div className="flex items-center gap-1">
              <button
                className="btn-ghost p-1"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="btn-ghost p-1"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ApiDocDetail({ entry, onClose }: { entry: ApiDocEntry; onClose: () => void }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(entry.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasRequestParams = entry.requestInfos && entry.requestInfos.length > 0
  const hasResponseParams = entry.responseInfos && entry.responseInfos.length > 0
  const hasRequestSchema = entry.requestSchema && Object.keys(entry.requestSchema).length > 0
  const hasResponseSchema = entry.responseSchema && Object.keys(entry.responseSchema).length > 0

  return (
    <div className="p-6 bg-white dark:bg-gray-900 relative animate-in fade-in slide-in-from-top-2 duration-200">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 btn-ghost rounded-full z-10"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <span className={clsx('badge font-mono text-sm px-2.5 py-1', getMethodBadgeClass(entry.method))}>
                {entry.method}
              </span>
              {entry.category && (
                <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium">
                  {entry.category}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {entry.title || t('apiDocs.noTitle')}
            </h2>
            <div className="flex items-center gap-2 group">
              <code className="text-sm font-mono text-brand-600 dark:text-brand-400 break-all bg-brand-50 dark:bg-brand-950/50 px-2 py-1 rounded">
                {entry.url}
              </code>
              <button
                onClick={handleCopy}
                className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                title={t('detail.copy')}
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {entry.description && (
            <div className="md:max-w-md">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic">
                {entry.description}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-10">
          {/* Request Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="w-1.5 h-5 bg-blue-500 rounded-full" />
              {t('apiDocs.sectionRequest')}
            </h3>

            {hasRequestParams ? (
              <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-medium">
                    <tr>
                      <th className="px-4 py-3">{t('apiDocs.paramPath')}</th>
                      <th className="px-4 py-3 w-32">{t('apiDocs.paramType')}</th>
                      <th className="px-4 py-3 w-28">{t('apiDocs.paramLocation')}</th>
                      <th className="px-4 py-3 w-24 text-center">{t('apiDocs.paramRequired')}</th>
                      <th className="px-4 py-3">{t('apiDocs.paramDescription')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {entry.requestInfos?.map((param, i) => (
                      <tr key={i} className="text-gray-700 dark:text-gray-300">
                        <td className="px-4 py-3 font-mono text-xs">{param.path}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 px-1.5 py-0.5 rounded">
                            {param.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {param.parameterType && (
                            <span className="text-[10px] font-bold uppercase tracking-tight bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                              {param.parameterType}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!param.nullable ? (
                            <span className="text-red-500 text-xs font-bold">YES</span>
                          ) : (
                            <span className="text-gray-400 text-xs">NO</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">{param.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !hasRequestSchema && (
              <p className="text-sm text-gray-400 italic pl-4">{t('apiDocs.noParameters')}</p>
            )}

            {hasRequestSchema && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1">{t('apiDocs.schemaTitle')}</h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(entry.requestSchema, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </section>

          {/* Response Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="w-1.5 h-5 bg-green-500 rounded-full" />
              {t('apiDocs.sectionResponse')}
            </h3>

            {hasResponseParams ? (
              <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-medium">
                    <tr>
                      <th className="px-4 py-3">{t('apiDocs.paramPath')}</th>
                      <th className="px-4 py-3 w-32">{t('apiDocs.paramType')}</th>
                      <th className="px-4 py-3 w-24 text-center">{t('apiDocs.paramNullable')}</th>
                      <th className="px-4 py-3">{t('apiDocs.paramDescription')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {entry.responseInfos?.map((param, i) => (
                      <tr key={i} className="text-gray-700 dark:text-gray-300">
                        <td className="px-4 py-3 font-mono text-xs pl-4" style={{ paddingLeft: `${(param.path.split('.').length - 1) * 1.5 + 1}rem` }}>
                          <span className="flex items-center gap-1">
                            {param.path.includes('.') && <span className="text-gray-400">└</span>}
                            {param.path.split('.').pop()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 px-1.5 py-0.5 rounded">
                            {param.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {param.nullable ? (
                            <span className="text-green-500 text-xs">YES</span>
                          ) : (
                            <span className="text-gray-400 text-xs">NO</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">{param.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !hasResponseSchema && (
              <p className="text-sm text-gray-400 italic pl-4">{t('apiDocs.noParameters')}</p>
            )}

            {hasResponseSchema && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1">{t('apiDocs.schemaTitle')}</h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(entry.responseSchema, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
