/**
 * supabaseS3Service.ts
 *
 * Reads JSONL / CSV log files stored in Supabase Storage (S3-compatible)
 * by the apilog library's ApiLogSupabaseS3Storage backend.
 *
 * File naming convention: api_log_<yyyyMMdd_HHmmss_SSS>_<counter>.<json|csv>
 * The files are sorted by name descending so the most recent files come first.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ApiLogEntry, ApiLogStats, PagedResponse, LogFilters, SortConfig, SupabaseS3Source } from '../types'
import { parseLogFile } from './fileService'
import { filterAndPage } from './fileService'

// ─── Client cache ─────────────────────────────────────────────────────────────

const clientCache = new Map<string, SupabaseClient>()

function getClient(source: SupabaseS3Source): SupabaseClient {
  const key = `${source.url}::${source.anonKey}`
  if (!clientCache.has(key)) {
    clientCache.set(key, createClient(source.url, source.anonKey))
  }
  return clientCache.get(key)!
}

export function invalidateS3Client(source: SupabaseS3Source) {
  const key = `${source.url}::${source.anonKey}`
  clientCache.delete(key)
}

// ─── Entry cache (avoid re-downloading the same files) ───────────────────────

const entryCache = new Map<string, ApiLogEntry[]>()  // key: sourceId

function cacheKey(source: SupabaseS3Source): string {
  return source.id
}

// ─── Core: list and download log files ────────────────────────────────────────

/**
 * Lists all log files in the bucket under keyPrefix, sorts them by name
 * descending (most recent first), downloads up to maxFiles, parses them,
 * and returns the combined entries.
 */
export async function loadS3Entries(source: SupabaseS3Source): Promise<ApiLogEntry[]> {
  const key = cacheKey(source)
  if (entryCache.has(key)) return entryCache.get(key)!

  const client = getClient(source)
  const bucket = source.bucket || 'api-logs'
  const prefix = source.keyPrefix || 'logs/'

  // List all files under prefix
  const { data: items, error } = await client.storage
    .from(bucket)
    .list(prefix.replace(/\/$/, ''), {
      limit: 1000,
      sortBy: { column: 'name', order: 'desc' },
    })

  if (error) throw new Error(`Storage list error: ${error.message}`)
  if (!items || items.length === 0) return []

  // Filter to only log files (.json, .jsonl, .ndjson, .csv)
  const logFiles = items
    .filter(item => item.name && /\.(json|jsonl|ndjson|csv)$/i.test(item.name))
    .slice(0, source.maxFiles || 5)

  // Download and parse each file in parallel
  const results = await Promise.allSettled(
    logFiles.map(async item => {
      const filePath = `${prefix.replace(/\/$/, '')}/${item.name}`
      const { data, error: dlErr } = await client.storage.from(bucket).download(filePath)
      if (dlErr) throw new Error(`Download error for ${item.name}: ${dlErr.message}`)
      if (!data) throw new Error(`Empty file: ${item.name}`)

      // Wrap the Blob as a File so parseLogFile can detect the extension
      const file = new File([data], item.name, { type: data.type })
      return parseLogFile(file)
    })
  )

  const entries: ApiLogEntry[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      entries.push(...result.value)
    }
    // silently skip failed files — they'll surface in the source error list
  }

  // Sort by requestTime descending
  entries.sort((a, b) => (a.requestTime < b.requestTime ? 1 : -1))

  entryCache.set(key, entries)
  return entries
}

/** Invalidate cached entries (e.g. when source config changes or user refreshes) */
export function invalidateS3Cache(sourceId: string) {
  entryCache.delete(sourceId)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchSupabaseS3Logs(
  source: SupabaseS3Source,
  filters: LogFilters,
  sort: SortConfig,
  page: number,
  pageSize: number,
): Promise<PagedResponse<ApiLogEntry>> {
  const entries = await loadS3Entries(source)
  return filterAndPage(entries, filters, sort, page, pageSize)
}

export async function fetchSupabaseS3Stats(source: SupabaseS3Source): Promise<ApiLogStats> {
  const entries = await loadS3Entries(source)
  const totalCount = entries.length
  if (totalCount === 0) {
    return { totalCount: 0, avgProcessingTimeMs: 0, maxProcessingTimeMs: 0, p99ProcessingTimeMs: 0, countByStatus: {}, countByMethod: {}, countByAppName: {} }
  }

  const times = entries.map(e => e.processingTimeMs).sort((a, b) => a - b)
  const avgProcessingTimeMs = times.reduce((s, v) => s + v, 0) / totalCount
  const maxProcessingTimeMs = times[times.length - 1] ?? 0
  const p99Index = Math.floor(totalCount * 0.99)
  const p99ProcessingTimeMs = times[Math.min(p99Index, totalCount - 1)] ?? 0

  const countByStatus: Record<string, number> = {}
  const countByMethod: Record<string, number> = {}
  const countByAppName: Record<string, number> = {}

  for (const e of entries) {
    const s = String(e.responseStatus)
    countByStatus[s] = (countByStatus[s] ?? 0) + 1
    countByMethod[e.method] = (countByMethod[e.method] ?? 0) + 1
    if (e.appName) {
      countByAppName[e.appName] = (countByAppName[e.appName] ?? 0) + 1
    }
  }

  return { totalCount, avgProcessingTimeMs, maxProcessingTimeMs, p99ProcessingTimeMs, countByStatus, countByMethod, countByAppName }
}

export async function fetchSupabaseS3AppNames(source: SupabaseS3Source): Promise<string[]> {
  const entries = await loadS3Entries(source)
  return [...new Set(entries.map(e => e.appName).filter((n): n is string => n !== null))].sort()
}

export async function testSupabaseS3Connection(source: SupabaseS3Source): Promise<void> {
  const client = getClient(source)
  const bucket = source.bucket || 'api-logs'
  const prefix = source.keyPrefix || 'logs/'
  const { error } = await client.storage
    .from(bucket)
    .list(prefix.replace(/\/$/, ''), { limit: 1 })
  if (error) throw new Error(error.message)
}
