import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSourceStore } from '../stores/sourceStore'
import { useFilterStore } from '../stores/filterStore'
import type { ApiLogEntry, ApiLogStats, ApiSource, FileSource, LogFilters, PagedResponse, SortConfig, SupabaseSource, SupabaseS3Source } from '../types'
import { fetchSupabaseLogs, fetchSupabaseStats } from '../services/supabaseService'
import { fetchApiLogs, fetchApiStats } from '../services/apiService'
import { fetchSupabaseS3Logs, fetchSupabaseS3Stats } from '../services/supabaseS3Service'
import { fetchFileApiLogs, fetchFileApiStats } from '../services/fileApiService'

// Fetch logs from a single source
function fetchFromSource(
  source: SupabaseSource | SupabaseS3Source | ApiSource | FileSource,
  filters: LogFilters,
  sort: SortConfig,
  page: number,
  pageSize: number,
  refreshTick: number,
): Promise<PagedResponse<ApiLogEntry>> {
  switch (source.type) {
    case 'supabase':
      return fetchSupabaseLogs(source, filters, sort, page, pageSize)
    case 'supabase-s3':
      return fetchSupabaseS3Logs(source, filters, sort, page, pageSize)
    case 'api':
      return fetchApiLogs(source, filters, sort, page, pageSize)
    // 'file' = Local File: always uses the /files + /files/content API
    case 'file':
      return fetchFileApiLogs(source as FileSource, filters, sort, page, pageSize, refreshTick)
  }
}

/**
 * Fetch logs from all selected sources in parallel, merge and sort results.
 */
export function useMergedLogs() {
  const allSources = useSourceStore(s => s.sources)
  const selectedSourceIds = useSourceStore(s => s.selectedSourceIds)
  const sources = useMemo(
    () => allSources.filter((src): src is SupabaseSource | SupabaseS3Source | ApiSource | FileSource =>
      src.enabled && selectedSourceIds.includes(src.id) && src.type !== 'api-docs'
    ),
    [allSources, selectedSourceIds]
  )
  const { filters, sort, page, pageSize, autoRefreshInterval, refreshTick } = useFilterStore()

  return useQuery({
    queryKey: ['logs', sources.map(s => s.id), filters, sort, page, pageSize, refreshTick],
    queryFn: async () => {
      if (sources.length === 0) {
        return {
          content: [] as ApiLogEntry[],
          totalElements: 0,
          totalPages: 0,
          page,
          size: pageSize,
          perSourceErrors: [] as Array<{ sourceId: string; sourceName: string; error: string }>,
        }
      }

      // Fetch from each source; collect errors per source
      const results = await Promise.allSettled(
        sources.map(src => fetchFromSource(src, filters, sort, page, pageSize, refreshTick))
      )

      const perSourceErrors: Array<{ sourceId: string; sourceName: string; error: string }> = []
      let combinedEntries: ApiLogEntry[] = []
      let totalElements = 0

      results.forEach((result, idx) => {
        const src = sources[idx]!
        if (result.status === 'fulfilled') {
          const tagged = result.value.content.map(e => ({
            ...e,
            _sourceId: src.id,
            _sourceName: src.name,
            _sourceColor: src.color,
          }))
          combinedEntries = combinedEntries.concat(tagged)
          totalElements += result.value.totalElements
        } else {
          perSourceErrors.push({
            sourceId: src.id,
            sourceName: src.name,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          })
        }
      })

      // Re-sort merged results
      combinedEntries.sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aVal = (a as any)[sort.field]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bVal = (b as any)[sort.field]
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
        return 0
      })

      // For multi-source, we just show the merged page (already paginated per source)
      return {
        content: combinedEntries,
        totalElements,
        totalPages: Math.ceil(totalElements / pageSize),
        page,
        size: pageSize,
        perSourceErrors,
      }
    },
    placeholderData: (prev) => prev,
    refetchInterval: autoRefreshInterval > 0 ? autoRefreshInterval : false,
  })
}

/**
 * Fetch stats from a specific source (for the stats cards).
 */
export function useSourceStats(sourceId: string) {
  const source = useSourceStore(s => s.sources.find(src => src.id === sourceId))
  const { autoRefreshInterval, refreshTick } = useFilterStore()

  return useQuery({
    queryKey: ['stats', sourceId, refreshTick],
    queryFn: async (): Promise<ApiLogStats> => {
      if (!source) throw new Error('Source not found')
      switch (source.type) {
        case 'supabase':    return fetchSupabaseStats(source as SupabaseSource)
        case 'supabase-s3': return fetchSupabaseS3Stats(source as SupabaseS3Source)
        case 'api':   return fetchApiStats({ ...source, type: 'api' } as ApiSource)
        case 'file':  return fetchFileApiStats(source as FileSource, refreshTick)
        default:
          throw new Error(`Stats not supported for source type ${source.type}`)
      }
    },
    enabled: !!source,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    refetchInterval: autoRefreshInterval > 0 ? autoRefreshInterval : false,
  })
}

