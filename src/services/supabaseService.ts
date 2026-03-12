import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ApiLogEntry, ApiLogStats, LogFilters, PagedResponse, SortConfig, SupabaseSource } from '../types'

// Cache clients per source
const clientCache = new Map<string, SupabaseClient>()

function getClient(source: SupabaseSource): SupabaseClient {
  const key = `${source.url}::${source.anonKey}`
  if (!clientCache.has(key)) {
    clientCache.set(key, createClient(source.url, source.anonKey))
  }
  return clientCache.get(key)!
}

export function invalidateClient(source: SupabaseSource) {
  const key = `${source.url}::${source.anonKey}`
  clientCache.delete(key)
}

export async function fetchSupabaseLogs(
  source: SupabaseSource,
  filters: LogFilters,
  sort: SortConfig,
  page: number,
  pageSize: number,
): Promise<PagedResponse<ApiLogEntry>> {
  const client = getClient(source)
  const table = source.tableName || 'api_logs'

  let query = client
    .from(table)
    .select('*', { count: 'exact' })

  // Apply filters
  if (filters.appName) {
    query = query.eq('app_name', filters.appName)
  }
  if (filters.url) {
    // Support % wildcard (SQL LIKE) same as the API backend
    const hasWildcard = filters.url.includes('%')
    query = hasWildcard ? query.like('url', filters.url) : query.ilike('url', `%${filters.url}%`)
  }
  if (filters.method) {
    query = query.eq('method', filters.method.toUpperCase())
  }
  if (filters.statusCode) {
    query = query.eq('response_status', parseInt(filters.statusCode))
  }
  if (filters.startTime) {
    query = query.gte('request_time', filters.startTime)
  }
  if (filters.endTime) {
    query = query.lte('request_time', filters.endTime)
  }
  if (filters.minProcessingTimeMs !== undefined) {
    query = query.gte('processing_time_ms', filters.minProcessingTimeMs)
  }
  if (filters.remoteAddr) {
    query = query.ilike('remote_addr', `%${filters.remoteAddr}%`)
  }
  if (filters.serverName) {
    query = query.ilike('server_name', `%${filters.serverName}%`)
  }

  // Sort (map camelCase → snake_case)
  const dbField = camelToSnake(String(sort.field))
  query = query.order(dbField, { ascending: sort.direction === 'asc' })

  // Pagination
  const from = page * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const entries = (data ?? []).map(row => snakeToCamelEntry(row))
  const totalElements = count ?? 0

  return {
    content: entries,
    page,
    size: pageSize,
    totalElements,
    totalPages: Math.ceil(totalElements / pageSize),
  }
}

export async function fetchSupabaseStats(source: SupabaseSource): Promise<ApiLogStats> {
  const client = getClient(source)
  const table = source.tableName || 'api_logs'

  const { data: rows, error } = await client
    .from(table)
    .select('response_status, method, app_name, processing_time_ms')

  if (error) throw new Error(error.message)
  if (!rows || rows.length === 0) {
    return { totalCount: 0, avgProcessingTimeMs: 0, maxProcessingTimeMs: 0, p99ProcessingTimeMs: 0, countByStatus: {}, countByMethod: {}, countByAppName: {} }
  }

  const totalCount = rows.length
  const times = rows.map(r => r.processing_time_ms ?? 0).sort((a, b) => a - b)
  const avgProcessingTimeMs = times.reduce((s, v) => s + v, 0) / totalCount
  const maxProcessingTimeMs = times[times.length - 1] ?? 0
  const p99Index = Math.floor(totalCount * 0.99)
  const p99ProcessingTimeMs = times[Math.min(p99Index, totalCount - 1)] ?? 0

  const countByStatus: Record<string, number> = {}
  const countByMethod: Record<string, number> = {}
  const countByAppName: Record<string, number> = {}

  for (const row of rows) {
    const status = String(row.response_status)
    countByStatus[status] = (countByStatus[status] ?? 0) + 1
    const method = String(row.method)
    countByMethod[method] = (countByMethod[method] ?? 0) + 1
    if (row.app_name) {
      countByAppName[row.app_name] = (countByAppName[row.app_name] ?? 0) + 1
    }
  }

  return { totalCount, avgProcessingTimeMs, maxProcessingTimeMs, p99ProcessingTimeMs, countByStatus, countByMethod, countByAppName }
}

export async function fetchSupabaseApps(source: SupabaseSource): Promise<string[]> {
  const client = getClient(source)
  const table = source.tableName || 'api_logs'
  const { data, error } = await client
    .from(table)
    .select('app_name')
    .not('app_name', 'is', null)
    .order('app_name')
  if (error) throw new Error(error.message)
  const names = [...new Set((data ?? []).map((r: { app_name: string }) => r.app_name).filter(Boolean))]
  return names as string[]
}

export async function testSupabaseConnection(source: SupabaseSource): Promise<void> {
  const client = getClient(source)
  const table = source.tableName || 'api_logs'
  const { error } = await client.from(table).select('id').limit(1)
  if (error) throw new Error(error.message)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function snakeToCamelEntry(row: Record<string, any>): ApiLogEntry {
  return {
    id: row.id,
    appName: row.app_name ?? null,
    url: row.url,
    method: row.method,
    queryParams: (tryParseJson(row.query_params) as Record<string, string[]>) ?? {},
    requestHeaders: (tryParseJson(row.request_headers) as Record<string, string>) ?? {},
    requestBody: row.request_body ?? null,
    responseStatus: row.response_status,
    responseContentType: row.response_content_type ?? null,
    responseBody: row.response_body ?? null,
    requestTime: row.request_time,
    responseTime: row.response_time,
    processingTimeMs: row.processing_time_ms,
    serverName: row.server_name ?? null,
    serverPort: row.server_port ?? null,
    remoteAddr: row.remote_addr ?? null,
  }
}

function tryParseJson(s: string | null): unknown {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}
