import { Activity, Clock, Zap, BarChart2, Loader2 } from 'lucide-react'
import { useActiveSources } from '../../stores/sourceStore'
import { useSourceStats } from '../../hooks/useLogs'
import { useT } from '../../i18n/useT'
import clsx from 'clsx'

export function StatsBar() {
  const activeSources = useActiveSources()

  if (activeSources.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-3">
      {activeSources.map(src => (
        <SourceStatsCards key={src.id} sourceId={src.id} sourceName={src.name} sourceColor={src.color} />
      ))}
    </div>
  )
}

function SourceStatsCards({
  sourceId,
  sourceName,
  sourceColor,
}: {
  sourceId: string
  sourceName: string
  sourceColor: string
}) {
  const t = useT()
  const { data: stats, isLoading, isFetching, error } = useSourceStats(sourceId)

  // 초기 로딩 (데이터 없음): 동일 크기의 skeleton 카드로 레이아웃 고정
  if (isLoading && !stats) {
    return (
      <div className="card flex items-center gap-4 px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium flex-shrink-0" style={{ color: sourceColor }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sourceColor }} />
          {sourceName}
        </span>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !stats) {
    return null
  }

  // Derive error rate from countByStatus
  const errorCount = Object.entries(stats.countByStatus)
    .filter(([code]) => Number(code) >= 400)
    .reduce((sum, [, n]) => sum + n, 0)
  const errorRate = stats.totalCount > 0 ? (errorCount / stats.totalCount) * 100 : 0

  // Top method
  const topMethod = Object.entries(stats.countByMethod)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'

  return (
    <div className="card flex items-center gap-4 px-4 py-3 text-sm overflow-x-auto relative">
      <span className="flex items-center gap-1.5 font-medium flex-shrink-0" style={{ color: sourceColor }}>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sourceColor }} />
        {sourceName}
        {isFetching && (
          <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-0.5" />
        )}
      </span>

      <StatItem icon={Activity} label={t('stats.total')} value={stats.totalCount.toLocaleString()} />

      <StatItem
        icon={BarChart2}
        label={t('stats.errors')}
        value={`${errorRate.toFixed(1)}%`}
        valueClass={
          errorRate > 5 ? 'text-red-600 dark:text-red-400' :
          errorRate > 1 ? 'text-amber-600 dark:text-amber-400' :
          'text-green-600 dark:text-green-400'
        }
      />

      <StatItem icon={Clock} label={t('stats.avg')} value={`${Math.round(stats.avgProcessingTimeMs)} ms`} />

      <StatItem
        icon={Zap}
        label={t('stats.p99')}
        value={`${stats.p99ProcessingTimeMs} ms`}
        valueClass={
          stats.p99ProcessingTimeMs > 1000 ? 'text-red-600 dark:text-red-400' :
          stats.p99ProcessingTimeMs > 300  ? 'text-amber-600 dark:text-amber-400' :
          undefined
        }
      />

      <StatItem icon={BarChart2} label={t('stats.top')} value={topMethod} />
    </div>
  )
}

function StatItem({
  icon: Icon,
  label,
  value,
  valueClass,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClass?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <Icon className="w-3.5 h-3.5 text-gray-400" />
      <span className="text-gray-500 dark:text-gray-400">{label}:</span>
      <span className={clsx('font-medium text-gray-900 dark:text-gray-100', mono && 'font-mono truncate max-w-36', valueClass)}>
        {value}
      </span>
    </div>
  )
}
