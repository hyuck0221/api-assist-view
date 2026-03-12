import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LogSource, SupabaseSource, SupabaseS3Source, ApiSource, FileSource, ApiDocsSource } from '../types'
import { SOURCE_COLORS } from '../types'

interface SourceStore {
  sources: LogSource[]
  selectedSourceIds: string[]   // which sources are active in the log viewer

  addSource: (source: Omit<LogSource, 'id' | 'color'>) => string
  updateSource: (id: string, updates: Partial<LogSource>) => void
  removeSource: (id: string) => void
  toggleSource: (id: string) => void

  setSelectedSourceIds: (ids: string[]) => void
  toggleSelectedSource: (id: string) => void
  selectAllSources: () => void
  deselectAllSources: () => void

  /** Replace all sources with imported list (preserves ids/colors from file) */
  replaceSources: (sources: LogSource[]) => void
  /** Merge imported sources — skips ids that already exist */
  mergeSources: (sources: LogSource[]) => void
}

function nextColor(sources: LogSource[]): string {
  const usedColors = new Set(sources.map(s => s.color))
  return SOURCE_COLORS.find(c => !usedColors.has(c)) ?? SOURCE_COLORS[sources.length % SOURCE_COLORS.length]!
}

export const useSourceStore = create<SourceStore>()(
  persist(
    (set, get) => ({
      sources: [],
      selectedSourceIds: [],

      addSource: (source) => {
        const id = crypto.randomUUID()
        const color = nextColor(get().sources)
        const newSource = { ...source, id, color } as LogSource
        set(state => ({
          sources: [...state.sources, newSource],
          selectedSourceIds: [...state.selectedSourceIds, id],
        }))
        return id
      },

      updateSource: (id, updates) => {
        set(state => ({
          sources: state.sources.map(s => s.id === id ? { ...s, ...updates } as LogSource : s),
        }))
      },

      removeSource: (id) => {
        set(state => ({
          sources: state.sources.filter(s => s.id !== id),
          selectedSourceIds: state.selectedSourceIds.filter(sid => sid !== id),
        }))
      },

      toggleSource: (id) => {
        set(state => ({
          sources: state.sources.map(s =>
            s.id === id ? { ...s, enabled: !s.enabled } as LogSource : s
          ),
        }))
      },

      setSelectedSourceIds: (ids) => set({ selectedSourceIds: ids }),

      toggleSelectedSource: (id) => {
        set(state => {
          const isSelected = state.selectedSourceIds.includes(id)
          return {
            selectedSourceIds: isSelected
              ? state.selectedSourceIds.filter(sid => sid !== id)
              : [...state.selectedSourceIds, id],
          }
        })
      },

      selectAllSources: () => {
        set(state => ({
          selectedSourceIds: state.sources.filter(s => s.enabled).map(s => s.id),
        }))
      },

      deselectAllSources: () => set({ selectedSourceIds: [] }),

      replaceSources: (incoming) => {
        set({
          sources: incoming,
          selectedSourceIds: incoming.filter(s => s.enabled).map(s => s.id),
        })
      },

      mergeSources: (incoming) => {
        set(state => {
          const existingIds = new Set(state.sources.map(s => s.id))
          const newOnes = incoming.filter(s => !existingIds.has(s.id))
          return {
            sources: [...state.sources, ...newOnes],
            selectedSourceIds: [
              ...state.selectedSourceIds,
              ...newOnes.filter(s => s.enabled).map(s => s.id),
            ],
          }
        })
      },
    }),
    { name: 'api-assist-view-sources' }
  )
)

// ─── Convenience typed hooks ───────────────────────────────────────────────────
// IMPORTANT: Never use .filter() inside a Zustand selector — it always returns
// a new array reference, causing useSyncExternalStore to loop infinitely.
// Instead, select the raw arrays and filter with useMemo inside the hook.

export const useActiveSources = () => {
  const sources = useSourceStore(s => s.sources)
  const selectedSourceIds = useSourceStore(s => s.selectedSourceIds)
  return useMemo(
    () => sources.filter(src => src.enabled && selectedSourceIds.includes(src.id)),
    [sources, selectedSourceIds]
  )
}

export const useSupabaseSources = () => {
  const sources = useSourceStore(s => s.sources)
  return useMemo(() => sources.filter((src): src is SupabaseSource => src.type === 'supabase'), [sources])
}

export const useSupabaseS3Sources = () => {
  const sources = useSourceStore(s => s.sources)
  return useMemo(() => sources.filter((src): src is SupabaseS3Source => src.type === 'supabase-s3'), [sources])
}

export const useApiSources = () => {
  const sources = useSourceStore(s => s.sources)
  return useMemo(() => sources.filter((src): src is ApiSource => src.type === 'api'), [sources])
}

export const useFileSources = () => {
  const sources = useSourceStore(s => s.sources)
  return useMemo(() => sources.filter((src): src is FileSource => src.type === 'file'), [sources])
}

export const useApiDocsSources = () => {
  const sources = useSourceStore(s => s.sources)
  return useMemo(() => sources.filter((src): src is ApiDocsSource => src.type === 'api-docs'), [sources])
}
