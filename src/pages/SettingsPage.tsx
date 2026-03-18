import { useState, useRef } from 'react'
import { Plus, ExternalLink, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react'
import { useSourceStore } from '../stores/sourceStore'
import { SourceCard } from '../components/settings/SourceCard'
import { SourceForm } from '../components/settings/SourceForm'
import { useT } from '../i18n/useT'
import type { LogSource } from '../types'

// ─── Export ───────────────────────────────────────────────────────────────────

function exportSources(sources: LogSource[]) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sources,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `apilog-sources-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Import dialog ────────────────────────────────────────────────────────────

interface ImportDialogProps {
  sources: LogSource[]
  onClose: () => void
}

function ImportDialog({ sources, onClose }: ImportDialogProps) {
  const t = useT()
  const { replaceSources, mergeSources } = useSourceStore()
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')

  const existingIds = new Set(useSourceStore.getState().sources.map(s => s.id))
  const newCount = sources.filter(s => !existingIds.has(s.id)).length
  const dupCount = sources.length - newCount

  function handleConfirm() {
    if (mode === 'replace') replaceSources(sources)
    else mergeSources(sources)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-brand-600" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('settings.import.title')}</h2>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">{t('settings.import.totalInFile')}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{sources.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">{t('settings.import.newSources')}</span>
            <span className="font-medium text-green-600 dark:text-green-400">{newCount}</span>
          </div>
          {dupCount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t('settings.import.duplicates')}</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">{dupCount}</span>
            </div>
          )}
        </div>

        {/* Mode selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.import.mode')}</label>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
              border-gray-200 dark:border-gray-700 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950">
              <input type="radio" name="import-mode" value="merge" checked={mode === 'merge'}
                onChange={() => setMode('merge')} className="mt-0.5 accent-brand-600" />
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('settings.import.merge')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.import.mergeDesc')}</div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
              border-gray-200 dark:border-gray-700 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950">
              <input type="radio" name="import-mode" value="replace" checked={mode === 'replace'}
                onChange={() => setMode('replace')} className="mt-0.5 accent-brand-600" />
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('settings.import.replaceAll')}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.import.replaceAllDesc')}</div>
              </div>
            </label>
          </div>
        </div>

        {mode === 'replace' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{t('settings.import.replaceWarning', useSourceStore.getState().sources.length)}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button className="btn-secondary flex-1" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary flex-1" onClick={handleConfirm} disabled={mode === 'merge' && newCount === 0}>
            <CheckCircle className="w-4 h-4" />
            {mode === 'replace' ? t('settings.import.replaceAll') : t('settings.import.addN', newCount)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const t = useT()
  const sources = useSourceStore(s => s.sources)
  const [adding, setAdding] = useState(false)
  const [importData, setImportData] = useState<LogSource[] | null>(null)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImportFile(file: File | null) {
    if (!file) return
    setImportError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        const list: LogSource[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.sources)
            ? parsed.sources
            : null
        if (!list) throw new Error(t('settings.import.errorFormat'))
        if (list.length === 0) throw new Error(t('settings.import.errorEmpty'))
        for (const s of list) {
          if (!s.id || !s.name || !s.type) throw new Error(t('settings.import.errorEntry'))
        }
        setImportData(list)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : t('settings.import.errorParse'))
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            {t('settings.import')}
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="sr-only"
            onChange={e => handleImportFile(e.target.files?.[0] ?? null)} />

          <button className="btn-secondary" onClick={() => exportSources(sources)}
            disabled={sources.length === 0} title={sources.length === 0 ? t('settings.noSourcesExport') : undefined}>
            <Download className="w-4 h-4" />
            {t('settings.export')}
          </button>

          <button onClick={() => setAdding(true)} className="btn-primary" disabled={adding}>
            <Plus className="w-4 h-4" />
            {t('settings.addSource')}
          </button>
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {importError}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="card p-5">
          <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-4">{t('settings.addNewSource')}</h2>
          <SourceForm onDone={() => setAdding(false)} />
        </div>
      )}

      {/* Source list */}
      {sources.length === 0 && !adding ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{t('settings.noSources')}</p>
          <button onClick={() => setAdding(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            {t('settings.addFirstSource')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      )}

      {/* API Reference */}
      <div className="card p-6 bg-brand-50/50 dark:bg-brand-950/10 border-brand-100 dark:border-brand-900/50">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('settings.apiRef.title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t('settings.apiRef.description')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider px-1">API Log</h3>
            <div className="space-y-2">
              <ApiEndpointItem method="GET" path="/api/logs" label={t('settings.apiRef.logs')} />
              <ApiEndpointItem method="GET" path="/api/logs/stats" label={t('settings.apiRef.stats')} />
              <ApiEndpointItem method="GET" path="/api/logs/apps" label={t('settings.apiRef.apps')} />
              <ApiEndpointItem method="GET" path="/api/logs/files" label={t('settings.apiRef.files')} />
              <ApiEndpointItem method="GET" path="/api/logs/files/content" label={t('settings.apiRef.filesContent')} />
              <ApiEndpointItem method="POST" path="/api/logs/receive" label={t('settings.apiRef.receive')} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider px-1">API Docs</h3>
            <div className="space-y-2">
              <ApiEndpointItem method="GET" path="/api/documents/status" label={t('settings.apiRef.docsStatus')} />
              <ApiEndpointItem method="GET" path="/api/documents/categories" label={t('settings.apiRef.docsCats')} />
              <ApiEndpointItem method="GET" path="/api/documents" label={t('settings.apiRef.docsList')} />
            </div>
            <h3 className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider px-1 pt-2">MCP</h3>
            <div className="space-y-2">
              <ApiEndpointItem method="POST" path="/mcp" label={t('settings.apiRef.mcpHttp')} />
              <ApiEndpointItem method="GET" path="/mcp/sse" label={t('settings.apiRef.mcpSse')} />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-brand-100 dark:border-brand-900/50 flex justify-center">
          <a
            href="https://github.com/hyuck0221/spring-api-assist"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            {t('settings.apiRef.viewDocs')}
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* MCP Connection Guide */}
      <McpGuideSection />

      {/* Import dialog */}
      {importData && (
        <ImportDialog
          sources={importData}
          onClose={() => setImportData(null)}
        />
      )}
    </div>
  )
}

function ApiEndpointItem({ method, path, label }: { method: string; path: string; label: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-brand-100 dark:border-brand-900/30 shadow-sm">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">{label}</span>
        <code className="text-[13px] font-mono text-gray-800 dark:text-gray-200">{path}</code>
      </div>
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        {method}
      </span>
    </div>
  )
}

function McpGuideSection() {
  const t = useT()

  const cursorSseConfig = `{
  "mcpServers": {
    "api-assist": {
      "url": "http://<baseUrl>/mcp/sse"
    }
  }
}`

  const cursorHttpConfig = `{
  "mcpServers": {
    "api-assist": {
      "type": "http",
      "url": "http://<baseUrl>/mcp"
    }
  }
}`

  const claudeSseCmd = `claude mcp add --transport sse api-assist \\
  http://<baseUrl>/mcp/sse`

  const claudeHttpCmd = `claude mcp add --transport http api-assist \\
  http://<baseUrl>/mcp`

  return (
    <div className="card p-6 border-purple-100 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/10">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
        {t('settings.mcpGuide.title')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {t('settings.mcpGuide.description')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cursor */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-gray-800 dark:text-gray-100">{t('settings.mcpGuide.cursor.title')}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.mcpGuide.cursor.desc')}</p>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">{t('settings.mcpGuide.httpLabel')}</p>
            <pre className="text-xs bg-gray-900 dark:bg-gray-950 text-green-400 rounded-lg p-3 overflow-x-auto leading-relaxed">{cursorHttpConfig}</pre>
            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">{t('settings.mcpGuide.sseLabel')}</p>
            <pre className="text-xs bg-gray-900 dark:bg-gray-950 text-green-400 rounded-lg p-3 overflow-x-auto leading-relaxed">{cursorSseConfig}</pre>
          </div>
        </div>

        {/* Claude Code */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-gray-800 dark:text-gray-100">{t('settings.mcpGuide.claudeCode.title')}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.mcpGuide.claudeCode.desc')}</p>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">{t('settings.mcpGuide.httpLabel')}</p>
            <pre className="text-xs bg-gray-900 dark:bg-gray-950 text-green-400 rounded-lg p-3 overflow-x-auto leading-relaxed">{claudeHttpCmd}</pre>
            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">{t('settings.mcpGuide.sseLabel')}</p>
            <pre className="text-xs bg-gray-900 dark:bg-gray-950 text-green-400 rounded-lg p-3 overflow-x-auto leading-relaxed">{claudeSseCmd}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
