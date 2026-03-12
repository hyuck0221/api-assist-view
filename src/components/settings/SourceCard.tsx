import { useState } from 'react'
import { Pencil, Trash2, Power, Database, Globe, FileText, Cloud, ChevronDown, BookOpen } from 'lucide-react'
import clsx from 'clsx'
import type { LogSource, SupabaseS3Source } from '../../types'
import { useSourceStore } from '../../stores/sourceStore'
import { SourceForm } from './SourceForm'
import { useT } from '../../i18n/useT'

const TYPE_ICONS = {
  supabase: Database,
  'supabase-s3': Cloud,
  api: Globe,
  file: FileText,
  'api-docs': BookOpen,
}

interface SourceCardProps {
  source: LogSource
}

export function SourceCard({ source }: SourceCardProps) {
  const t = useT()
  const { removeSource, toggleSource } = useSourceStore()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const Icon = TYPE_ICONS[source.type]

  const TYPE_LABELS = {
    supabase: t('sourceCard.type.supabase'),
    'supabase-s3': t('sourceCard.type.supabaseS3'),
    api: t('sourceCard.type.api'),
    file: t('sourceCard.type.file'),
    'api-docs': t('sourceCard.type.apiDocs'),
  }

  return (
    <div className={clsx(
      'card overflow-hidden transition-opacity',
      !source.enabled && 'opacity-60'
    )}>
      <div className="flex items-center gap-3 p-4">
        {/* Color dot + icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: source.color + '22' }}
        >
          <Icon className="w-4 h-4" style={{ color: source.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {source.name}
            </span>
            <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {TYPE_LABELS[source.type]}
            </span>
            {!source.enabled && (
              <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-400">{t('sourceCard.disabled')}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {sourceSubtitle(source)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => toggleSource(source.id)}
            className={clsx('btn-ghost p-2', source.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400')}
            title={source.enabled ? t('sourceCard.disableSource') : t('sourceCard.enableSource')}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEditing(prev => !prev)}
            className="btn-ghost p-2"
            title={t('common.edit')}
          >
            {editing ? <ChevronDown className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="btn-ghost p-2 text-red-500 dark:text-red-400"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <SourceForm existing={source} onDone={() => setEditing(false)} />
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="border-t border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-400 mb-3">
            {t('sourceCard.deleteConfirm', source.name)}
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-danger flex-1" onClick={() => removeSource(source.id)}>
              {t('common.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function sourceSubtitle(source: LogSource): string {
  switch (source.type) {
    case 'supabase':    return `${source.url} → ${source.tableName || 'api_logs'}`
    case 'supabase-s3': {
      const s3 = source as SupabaseS3Source
      return `${s3.url} / ${s3.bucket || 'api-logs'}/${s3.keyPrefix || 'logs/'} (max ${s3.maxFiles || 5} files)`
    }
    case 'api':         return `${source.baseUrl}${source.basePath || '/apilog'}`
    case 'file':        return `${source.baseUrl}${source.basePath || '/apilog'}`
    case 'api-docs':    return `${source.baseUrl}${source.basePath || '/apilog'}/document`
  }
}
