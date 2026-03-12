import { useState } from 'react'
import { X, Clock, Globe, Server, Cpu, Activity, Copy, Check, GripVertical } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import type { ApiLogEntry } from '../../types'
import { getStatusBadgeClass, getMethodBadgeClass } from '../../types'
import { useT } from '../../i18n/useT'

interface LogDetailProps {
  entry: ApiLogEntry
  onClose: () => void
}

export function LogDetail({ entry, onClose }: LogDetailProps) {
  const t = useT()

  return (
    <div className="overflow-hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry._sourceColor }}
          />
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {entry._sourceName}
          </span>
          <span className={clsx('badge', getMethodBadgeClass(entry.method))}>
            {entry.method}
          </span>
          <span className={clsx('badge', getStatusBadgeClass(entry.responseStatus))}>
            {entry.responseStatus}
          </span>
          <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
            {entry.url}
          </span>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
        {/* Meta */}
        <div className="col-span-full grid grid-cols-2 md:grid-cols-4 gap-3">
          {entry.appName && (
            <MetaCard icon={Activity} label={t('detail.appName')}>
              {entry.appName}
            </MetaCard>
          )}
          <MetaCard icon={Clock} label={t('detail.requestTime')}>
            {entry.requestTime ? format(new Date(entry.requestTime), 'yyyy-MM-dd HH:mm:ss.SSS') : '-'}
          </MetaCard>
          <MetaCard icon={Cpu} label={t('detail.processingTime')}>
            <span className={entry.processingTimeMs > 1000 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
              {entry.processingTimeMs.toLocaleString()} ms
            </span>
          </MetaCard>
          <MetaCard icon={Globe} label={t('detail.remoteAddr')}>
            {entry.remoteAddr ?? '-'}
          </MetaCard>
          <MetaCard icon={Server} label={t('detail.server')}>
            {entry.serverName
              ? `${entry.serverName}${entry.serverPort ? `:${entry.serverPort}` : ''}`
              : '-'
            }
          </MetaCard>
        </div>

        {/* Query params */}
        {entry.queryParams && Object.keys(entry.queryParams).length > 0 && (
          <Section title={t('detail.queryParams')} className="col-span-full">
            <ParamTable params={entry.queryParams} />
          </Section>
        )}

        {/* Request headers */}
        {entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0 && (
          <Section title={t('detail.requestHeaders')}>
            <ParamTable params={entry.requestHeaders} />
          </Section>
        )}

        {/* Response info */}
        <Section title={t('detail.responseInfo')}>
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">Content-Type</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {entry.responseContentType ?? '-'}
              </span>
            </div>
          </div>
        </Section>

        {/* Request body */}
        {entry.requestBody && (
          <Section title={t('detail.requestBody')} className="col-span-full">
            <CodeBlock content={entry.requestBody} />
          </Section>
        )}

        {/* Response body */}
        {entry.responseBody && (
          <Section title={t('detail.responseBody')} className="col-span-full">
            <CodeBlock content={entry.responseBody} />
          </Section>
        )}

        {/* Entry ID */}
        <div className="col-span-full">
          <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">
            ID: {entry.id}
          </span>
        </div>
      </div>
    </div>
  )
}

function MetaCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono truncate">
        {children}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </h4>
      {children}
    </div>
  )
}

function ParamTable({ params }: { params: Record<string, string | string[]> }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {Object.entries(params).map(([k, v]) => (
            <tr key={k} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-1.5 font-medium text-gray-700 dark:text-gray-300 w-1/3 font-mono align-top">
                {k}
              </td>
              <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400 font-mono break-all">
                {Array.isArray(v) ? v.map(unescapeUnicode).join(', ') : unescapeUnicode(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeBlock({ content }: { content: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const formatted = tryFormatJson(content)

  function handleCopy() {
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative group">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={clsx(
          'absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all',
          'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600',
          'text-gray-600 dark:text-gray-300',
          'opacity-0 group-hover:opacity-100'
        )}
        title={t('detail.copy')}
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        {copied ? t('detail.copied') : t('detail.copy')}
      </button>

      {/* Resize handle hint */}
      <div className="absolute bottom-1 right-1 z-10 pointer-events-none opacity-30">
        <GripVertical className="w-3 h-3 text-gray-500 rotate-45" />
      </div>

      <pre
        className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-auto whitespace-pre-wrap break-all"
        style={{ minHeight: '64px', height: '256px', resize: 'vertical', overflow: 'auto' }}
      >
        {formatted}
      </pre>
    </div>
  )
}

function unescapeUnicode(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/gi, (match, hex) => {
    const code = parseInt(hex, 16)
    // Keep control characters (0x00–0x1F) escaped; unescape everything else
    return code >= 0x20 ? String.fromCharCode(code) : match
  })
}

function tryFormatJson(s: string): string {
  try {
    return unescapeUnicode(JSON.stringify(JSON.parse(s), null, 2))
  } catch {
    return unescapeUnicode(s)
  }
}
