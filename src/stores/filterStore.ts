import { create } from 'zustand'
import type { LogFilters, SortConfig } from '../types'

interface FilterStore {
  filters: LogFilters
  sort: SortConfig
  page: number
  pageSize: number
  autoRefreshInterval: number  // ms; 0 = off
  refreshTick: number          // incremented to trigger manual refresh

  setFilters: (filters: Partial<LogFilters>) => void
  resetFilters: () => void
  setSort: (sort: SortConfig) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setAutoRefreshInterval: (ms: number) => void
  triggerRefresh: () => void
}

const defaultFilters: LogFilters = {}
const defaultSort: SortConfig = { field: 'requestTime', direction: 'desc' }

export const useFilterStore = create<FilterStore>((set) => ({
  filters: defaultFilters,
  sort: defaultSort,
  page: 0,
  pageSize: 50,
  autoRefreshInterval: 0,
  refreshTick: 0,

  setFilters: (filters) =>
    set(state => ({ filters: { ...state.filters, ...filters }, page: 0 })),

  resetFilters: () =>
    set({ filters: defaultFilters, page: 0 }),

  setSort: (sort) =>
    set({ sort, page: 0 }),

  setPage: (page) => set({ page }),

  setPageSize: (pageSize) => set({ pageSize, page: 0 }),

  setAutoRefreshInterval: (ms) => set({ autoRefreshInterval: ms }),

  triggerRefresh: () => set(state => ({ refreshTick: state.refreshTick + 1 })),
}))
