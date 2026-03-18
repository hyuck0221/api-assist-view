import { useState } from 'react'
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'
import type { LogSource, SourceType, SupabaseSource, SupabaseS3Source, ApiSource, FileSource, ApiDocsSource } from '../../types'
import { useSourceStore } from '../../stores/sourceStore'
import { testSupabaseConnection, invalidateClient } from '../../services/supabaseService'
import { testSupabaseS3Connection, invalidateS3Client, invalidateS3Cache } from '../../services/supabaseS3Service'
import { testApiConnection } from '../../services/apiService'
import { testFileApiConnection, invalidateFileCache } from '../../services/fileApiService'
import { testApiDocsConnection } from '../../services/apiDocsService'
import { useT } from '../../i18n/useT'

interface SourceFormProps {
  existing?: LogSource
  onDone: () => void
}

type TestState = 'idle' | 'testing' | 'ok' | 'error'

export function SourceForm({ existing, onDone }: SourceFormProps) {
  const t = useT()
  const { addSource, updateSource } = useSourceStore()

  const SOURCE_TYPE_OPTIONS: Array<{ value: SourceType; label: string; desc: string }> = [
    { value: 'api',        label: t('sourceForm.type.api.label'),        desc: t('sourceForm.type.api.desc') },
    { value: 'file',       label: t('sourceForm.type.file.label'),       desc: t('sourceForm.type.file.desc') },
    { value: 'supabase',   label: t('sourceForm.type.supabase.label'),   desc: t('sourceForm.type.supabase.desc') },
    { value: 'supabase-s3',label: t('sourceForm.type.supabaseS3.label'), desc: t('sourceForm.type.supabaseS3.desc') },
    { value: 'api-docs',   label: t('sourceForm.type.apiDocs.label'),    desc: t('sourceForm.type.apiDocs.desc') },
  ]

  const [type, setType] = useState<SourceType>(existing?.type ?? 'api')
  const [name, setName] = useState(existing?.name ?? '')

  // Supabase DB fields
  const [sbUrl, setSbUrl] = useState((existing as SupabaseSource | undefined)?.url ?? '')
  const [sbKey, setSbKey] = useState((existing as SupabaseSource | undefined)?.anonKey ?? '')
  const [sbTable, setSbTable] = useState((existing as SupabaseSource | undefined)?.tableName ?? 'api_logs')

  // Supabase S3 fields
  const s3 = existing as SupabaseS3Source | undefined
  const [s3Url, setS3Url] = useState(s3?.url ?? '')
  const [s3Key, setS3Key] = useState(s3?.anonKey ?? '')
  const [s3Bucket, setS3Bucket] = useState(s3?.bucket ?? 'api-logs')
  const [s3Prefix, setS3Prefix] = useState(s3?.keyPrefix ?? 'logs/')
  const [s3Format, setS3Format] = useState<'json' | 'csv'>(s3?.format ?? 'json')
  const [s3MaxFiles, setS3MaxFiles] = useState(s3?.maxFiles ?? 5)

  // API (Application DB) source fields
  const [apiBaseUrl, setApiBaseUrl] = useState((existing as ApiSource | undefined)?.baseUrl ?? '')
  const [apiBasePath, setApiBasePath] = useState((existing as ApiSource | undefined)?.basePath ?? '/api/logs')
  const [apiKey, setApiKey] = useState((existing as ApiSource | undefined)?.apiKey ?? '')

  // API Docs fields
  const apiDocs = existing as ApiDocsSource | undefined
  const [apiDocsBaseUrl, setApiDocsBaseUrl] = useState(apiDocs?.baseUrl ?? '')
  const [apiDocsBasePath, setApiDocsBasePath] = useState(apiDocs?.basePath ?? '/api/documents')
  const [apiDocsApiKey, setApiDocsApiKey] = useState(apiDocs?.apiKey ?? '')

  // Local File fields
  const file = existing as FileSource | undefined
  const [fileBaseUrl, setFileBaseUrl] = useState(file?.baseUrl ?? '')
  const [fileBasePath, setFileBasePath] = useState(file?.basePath ?? '/api/logs')
  const [fileApiKey, setFileApiKey] = useState(file?.apiKey ?? '')
  const [fileDirectory, setFileDirectory] = useState(file?.directory ?? '')
  const [fileFormat, setFileFormat] = useState<'json' | 'csv'>(file?.format ?? 'json')
  const [fileMaxFiles, setFileMaxFiles] = useState(file?.maxFiles ?? 5)

  const [showApiKey, setShowApiKey] = useState(false)

  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState('')

  const isEdit = !!existing

  function buildSource(): Omit<LogSource, 'id' | 'color'> {
    const base = { name, enabled: true }
    switch (type) {
      case 'supabase':
        return { ...base, type: 'supabase', url: sbUrl, anonKey: sbKey, tableName: sbTable || 'api_logs' } as Omit<SupabaseSource, 'id' | 'color'>
      case 'supabase-s3':
        return { ...base, type: 'supabase-s3', url: s3Url, anonKey: s3Key, bucket: s3Bucket || 'api-logs', keyPrefix: s3Prefix || 'logs/', format: s3Format, maxFiles: s3MaxFiles } as Omit<SupabaseS3Source, 'id' | 'color'>
      case 'api':
        return { ...base, type: 'api', baseUrl: apiBaseUrl, basePath: apiBasePath || '/api/logs', apiKey: apiKey || undefined } as Omit<ApiSource, 'id' | 'color'>
      case 'api-docs':
        return { ...base, type: 'api-docs', baseUrl: apiDocsBaseUrl, basePath: apiDocsBasePath || '/api/documents', apiKey: apiDocsApiKey || undefined } as Omit<ApiDocsSource, 'id' | 'color'>
      case 'file':
        return {
          ...base,
          type: 'file',
          baseUrl: fileBaseUrl,
          basePath: fileBasePath || '/api/logs',
          apiKey: fileApiKey || undefined,
          directory: fileDirectory || undefined,
          format: fileDirectory ? fileFormat : undefined,
          maxFiles: fileDirectory ? fileMaxFiles : undefined,
        } as Omit<FileSource, 'id' | 'color'>
    }
  }

  async function handleTest() {
    setTestState('testing')
    setTestError('')
    try {
      const src = buildSource()
      if (src.type === 'supabase') {
        await testSupabaseConnection(src as SupabaseSource)
      } else if (src.type === 'supabase-s3') {
        await testSupabaseS3Connection(src as SupabaseS3Source)
      } else if (src.type === 'file') {
        await testFileApiConnection(src as FileSource)
      } else if (src.type === 'api-docs') {
        await testApiDocsConnection(src as ApiDocsSource)
      } else {
        await testApiConnection({ ...src, type: 'api' } as ApiSource)
      }
      setTestState('ok')
    } catch (e) {
      setTestState('error')
      const status = (e as { status?: number }).status
      const is401 = status === 401 || (e instanceof Error && e.message.startsWith('HTTP 401'))
      const currentApiKey = type === 'api' ? apiKey : type === 'api-docs' ? apiDocsApiKey : type === 'file' ? fileApiKey : ''

      if (is401) {
        setTestError(t(currentApiKey ? 'sourceForm.error.invalidApiKey' : 'sourceForm.error.unauthorized'))
      } else if (e instanceof TypeError) {
        // ERR_CONNECTION_REFUSED vs CORS preflight 401 are both TypeError.
        // Use a no-cors probe: succeeds (opaque response) if server is reachable, throws if not.
        const baseUrl = type === 'api' ? apiBaseUrl : type === 'api-docs' ? apiDocsBaseUrl : type === 'file' ? fileBaseUrl : ''
        try {
          await fetch(baseUrl, { method: 'HEAD', mode: 'no-cors' })
          // Server reachable → CORS preflight was blocked (likely 401)
          setTestError(t(currentApiKey ? 'sourceForm.error.invalidApiKey' : 'sourceForm.error.unauthorized'))
        } catch {
          // Server genuinely unreachable
          setTestError(t('sourceForm.error.connectionFailed'))
        }
      } else {
        setTestError(t('sourceForm.error.connectionFailed'))
      }
    }
  }

  function handleSubmit() {
    const src = buildSource()
    if (isEdit && existing) {
      if (src.type === 'supabase') invalidateClient(src as SupabaseSource)
      if (src.type === 'supabase-s3') {
        invalidateS3Client(src as SupabaseS3Source)
        invalidateS3Cache(existing.id)
      }
      if (src.type === 'file') invalidateFileCache(existing.id)
      updateSource(existing.id, src as Partial<LogSource>)
    } else {
      addSource(src)
    }
    onDone()
  }

  const isValid = name.trim() !== '' && (
    type === 'supabase'    ? sbUrl !== '' && sbKey !== '' :
    type === 'supabase-s3' ? s3Url !== '' && s3Key !== '' :
    type === 'api'         ? apiBaseUrl !== '' :
    type === 'api-docs'    ? apiDocsBaseUrl !== '' :
    type === 'file'        ? fileBaseUrl !== '' : false
  )

  return (
    <div className="space-y-5">
      {/* Source type — only changeable on new */}
      {!isEdit && (
        <div>
          <label className="label">{t('sourceForm.sourceType')}</label>
          <div className="grid grid-cols-2 gap-2">
            {SOURCE_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={clsx(
                  'text-left p-3 rounded-lg border transition-colors',
                  type === opt.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                <div className={clsx(
                  'text-sm font-medium',
                  type === opt.value ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-gray-200'
                )}>
                  {opt.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="label">{t('sourceForm.sourceName')}</label>
        <input
          type="text"
          className="input"
          placeholder={t('sourceForm.sourceNamePlaceholder')}
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      {/* Supabase DB */}
      {type === 'supabase' && (
        <>
          <div>
            <label className="label">{t('sourceForm.field.supabaseUrl')}</label>
            <input type="text" className="input" placeholder="https://xxxx.supabase.co"
              value={sbUrl} onChange={e => setSbUrl(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('sourceForm.field.anonKey')}</label>
            <input type="password" className="input" placeholder="eyJhbGci..."
              value={sbKey} onChange={e => setSbKey(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('sourceForm.field.tableName')}</label>
            <input type="text" className="input" placeholder="api_logs"
              value={sbTable} onChange={e => setSbTable(e.target.value)} />
          </div>
        </>
      )}

      {/* Supabase S3 */}
      {type === 'supabase-s3' && (
        <>
          <div>
            <label className="label">{t('sourceForm.field.supabaseUrl')}</label>
            <input type="text" className="input" placeholder="https://xxxx.supabase.co"
              value={s3Url} onChange={e => setS3Url(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('sourceForm.field.serviceRoleKey')}</label>
            <input type="password" className="input" placeholder="eyJhbGci..."
              value={s3Key} onChange={e => setS3Key(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('sourceForm.field.serviceRoleKeyHint')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('sourceForm.field.bucket')}</label>
              <input type="text" className="input" placeholder="api-logs"
                value={s3Bucket} onChange={e => setS3Bucket(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('sourceForm.field.keyPrefix')}</label>
              <input type="text" className="input" placeholder="logs/"
                value={s3Prefix} onChange={e => setS3Prefix(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('sourceForm.field.fileFormat')}</label>
              <select className="input" value={s3Format} onChange={e => setS3Format(e.target.value as 'json' | 'csv')}>
                <option value="json">JSONL (.json / .jsonl)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </div>
            <div>
              <label className="label">{t('sourceForm.field.maxFiles')}</label>
              <input type="number" min={1} max={50} className="input" value={s3MaxFiles}
                onChange={e => setS3MaxFiles(Number(e.target.value))} />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('sourceForm.field.maxFilesHint')}
              </p>
            </div>
          </div>
        </>
      )}

      {/* API */}
      {type === 'api' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">{t('sourceForm.field.baseUrl')}</label>
              <input type="text" className="input" placeholder="http://localhost:8080"
                value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('sourceForm.field.basePath')}</label>
              <input type="text" className="input" placeholder="/api/logs"
                value={apiBasePath} onChange={e => setApiBasePath(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
            {t('sourceForm.endpointHint', apiBaseUrl, apiBasePath)}
          </p>
          <div>
            <label className="label">
              {t('sourceForm.field.apiKey')}{' '}
              <span className="font-normal text-gray-400">{t('sourceForm.field.apiKeyOptional')}</span>
            </label>
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} className="input pr-9" placeholder={t('sourceForm.field.apiKeyPlaceholder')}
                value={apiKey} onChange={e => setApiKey(e.target.value)} />
              <button type="button" onClick={() => setShowApiKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* API Docs */}
      {type === 'api-docs' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">{t('sourceForm.field.baseUrl')}</label>
              <input type="text" className="input" placeholder="http://localhost:8080"
                value={apiDocsBaseUrl} onChange={e => setApiDocsBaseUrl(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('sourceForm.field.basePath')}</label>
              <input type="text" className="input" placeholder="/api/documents"
                value={apiDocsBasePath} onChange={e => setApiDocsBasePath(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
            {t('sourceForm.apiDocsEndpointHint', apiDocsBaseUrl, apiDocsBasePath)}
          </p>
          <div>
            <label className="label">{t('sourceForm.field.apiKey')}</label>
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} className="input pr-9" placeholder={t('sourceForm.field.apiKeyPlaceholder')}
                value={apiDocsApiKey} onChange={e => setApiDocsApiKey(e.target.value)} />
              <button type="button" onClick={() => setShowApiKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Local File */}
      {type === 'file' && (
        <>
          {/* Connection */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">{t('sourceForm.field.baseUrl')}</label>
              <input type="text" className="input" placeholder="http://localhost:8080"
                value={fileBaseUrl} onChange={e => setFileBaseUrl(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('sourceForm.field.basePath')}</label>
              <input type="text" className="input" placeholder="/api/logs"
                value={fileBasePath} onChange={e => setFileBasePath(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
            {t('sourceForm.endpointHint', fileBaseUrl, fileBasePath)}
          </p>
          <div>
            <label className="label">
              {t('sourceForm.field.apiKey')}{' '}
              <span className="font-normal text-gray-400">{t('sourceForm.field.apiKeyOptional')}</span>
            </label>
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} className="input pr-9" placeholder={t('sourceForm.field.apiKeyPlaceholder')}
                value={fileApiKey} onChange={e => setFileApiKey(e.target.value)} />
              <button type="button" onClick={() => setShowApiKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* File listing options */}
          <div>
            <label className="label">{t('sourceForm.field.logDirectory')}</label>
            <input type="text" className="input" placeholder={t('sourceForm.field.logDirectoryPlaceholder')}
              value={fileDirectory} onChange={e => setFileDirectory(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('sourceForm.field.logDirectoryHint')}
            </p>
          </div>

          {fileDirectory && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('sourceForm.field.fileFormat')}</label>
                <select className="input" value={fileFormat} onChange={e => setFileFormat(e.target.value as 'json' | 'csv')}>
                  <option value="json">JSONL (.json / .jsonl)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
              </div>
              <div>
                <label className="label">{t('sourceForm.field.maxFiles')}</label>
                <input type="number" min={1} max={50} className="input" value={fileMaxFiles}
                  onChange={e => setFileMaxFiles(Number(e.target.value))} />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('sourceForm.field.maxFilesHint')}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Test connection */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testState === 'testing' || !isValid}
          className="btn-secondary"
        >
          {testState === 'testing'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('sourceForm.testing')}</>
            : t('sourceForm.testConnection')
          }
        </button>
        {testState === 'ok' && (
          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" /> {t('sourceForm.connectedOk')}
          </span>
        )}
        {testState === 'error' && (
          <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4" /> {testError}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button className="btn-secondary flex-1" onClick={onDone}>{t('common.cancel')}</button>
        <button className="btn-primary flex-1" disabled={!isValid} onClick={handleSubmit}>
          {isEdit ? t('sourceForm.saveChanges') : t('sourceForm.addSource')}
        </button>
      </div>
    </div>
  )
}
