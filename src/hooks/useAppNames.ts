import { useQuery } from '@tanstack/react-query'
import { useActiveSources } from '../stores/sourceStore'
import type { ApiSource, SupabaseSource, SupabaseS3Source } from '../types'
import { fetchApiApps } from '../services/apiService'
import { fetchSupabaseApps } from '../services/supabaseService'
import { fetchSupabaseS3AppNames } from '../services/supabaseS3Service'


/**
 * Fetches the list of distinct app names from all active sources.
 * Used to populate the appName filter dropdown.
 */
export function useAppNames() {
  const activeSources = useActiveSources()

  return useQuery({
    queryKey: ['appNames', activeSources.map(s => s.id)],
    queryFn: async (): Promise<string[]> => {
      const logSources = activeSources.filter(s => s.type !== 'api-docs')
      if (logSources.length === 0) return []

      const results = await Promise.allSettled(
        logSources.map(src => {
          switch (src.type) {
            case 'api':
            case 'file':
              return fetchApiApps({ ...src, type: 'api' } as ApiSource)
            case 'supabase':    return fetchSupabaseApps(src as SupabaseSource)
            case 'supabase-s3': return fetchSupabaseS3AppNames(src as SupabaseS3Source)
            default: return Promise.resolve([])
          }
        })
      )

      const allNames = new Set<string>()
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) r.value.forEach(n => allNames.add(n))
      })
      return [...allNames].sort()
    },
    staleTime: 60_000,
    enabled: activeSources.length > 0,
  })
}
