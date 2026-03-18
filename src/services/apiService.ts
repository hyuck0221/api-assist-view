/**
 * apiService.ts
 *
 * Communicates with a Spring Boot app that uses the apilog library (viewer module).
 *
 * Endpoints:
 *
 *   POST /api/logs/receive              — HTTP ingestion (not used by this frontend)
 *
 *   GET  /api/logs                      — paginated + filtered log list
 *     Query params:
 *       appName          string   — exact match on application name
 *       method           string   — HTTP method (GET, POST, …)
 *       url              string   — URL path, supports % wildcard (SQL LIKE)
 *       statusCode       number   — HTTP response status code
 *       startTime        string   — ISO-8601 lower bound for requestTime
 *       endTime          string   — ISO-8601 upper bound for requestTime
 *       minProcessingTimeMs  number  — minimum processing time (ms)
 *       page             number   — 0-based (default 0)
 *       size             number   — page size (default 20, max 200)
 *       sortBy           string   — request_time | processing_time_ms | response_status | url | method | app_name
 *       sortDir          string   — ASC | DESC (default DESC)
 *     Response: ApiLogPage
 *
 *   GET  /api/logs/:id                  — single entry, 404 if not found
 *
 *   GET  /api/logs/stats                — aggregate statistics
 *     Query params: startTime, endTime (ISO-8601, optional)
 *     Response: ApiLogStats
 *
 *   GET  /api/logs/apps                 — distinct app names
 *     Response: string[]
 */

import type { ApiLogEntry, ApiLogStats, ApiSource, LogFilters, PagedResponse, SortConfig } from '../types'

// The Spring Boot library uses snake_case field names for sortBy
const SORT_FIELD_MAP: Partial<Record<keyof ApiLogEntry, string>> = {
  requestTime:     'request_time',
  processingTimeMs: 'processing_time_ms',
  responseStatus:  'response_status',
  url:             'url',
  method:          'method',
  appName:         'app_name',
}

function toSortByParam(field: keyof ApiLogEntry): string {
  return SORT_FIELD_MAP[field] ?? 'request_time'
}

function toLocalDateTimeParam(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function buildHeaders(source: ApiSource): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (source.apiKey) headers['X-Api-Key'] = source.apiKey
  if (source.extraHeaders) Object.assign(headers, source.extraHeaders)
  return headers
}

function resolveUrl(source: ApiSource, path: string): string {
  const base = source.baseUrl.replace(/\/$/, '')
  const bp = (source.basePath || '/api/logs').replace(/\/$/, '')
  return `${base}${bp}${path}`
}

async function apiFetch<T>(source: ApiSource, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(resolveUrl(source, path))
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }
  // URLSearchParams encodes spaces as '+'; replace with '%20' for server compatibility
  const res = await fetch(url.toString().replace(/\+/g, '%20'), { headers: buildHeaders(source) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}: ${text || res.statusText}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

/** Shape returned by GET {basePath}/logs */
interface SpringPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  page: number   // current page (0-based) — API field name is "page"
  size: number
}

export async function fetchApiLogs(
  source: ApiSource,
  filters: LogFilters,
  sort: SortConfig,
  page: number,
  pageSize: number,
): Promise<PagedResponse<ApiLogEntry>> {
  const params: Record<string, string> = {
    page: String(page),
    size: String(Math.min(pageSize, 200)),
    sortBy: toSortByParam(sort.field),
    sortDir: sort.direction.toUpperCase(),
  }
  if (filters.appName)             params['appName'] = filters.appName
  if (filters.url)                 params['url'] = filters.url
  if (filters.method)              params['method'] = filters.method
  if (filters.statusCode)          params['statusCode'] = filters.statusCode
  if (filters.startTime)           params['startTime'] = toLocalDateTimeParam(filters.startTime)
  if (filters.endTime)             params['endTime'] = toLocalDateTimeParam(filters.endTime)
  if (filters.remoteAddr)          params['remoteAddr'] = filters.remoteAddr
  if (filters.serverName)          params['serverName'] = filters.serverName
  if (filters.minProcessingTimeMs !== undefined) params['minProcessingTimeMs'] = String(filters.minProcessingTimeMs)

  const spring = await apiFetch<SpringPage<ApiLogEntry>>(source, '', params)
  return {
    content: spring.content,
    page: spring.page,
    size: spring.size,
    totalElements: spring.totalElements,
    totalPages: spring.totalPages,
  }
}

export async function fetchApiLogById(source: ApiSource, id: string): Promise<ApiLogEntry> {
  return apiFetch<ApiLogEntry>(source, `/${id}`)
}

export async function fetchApiStats(
  source: ApiSource,
  startTime?: string,
  endTime?: string,
): Promise<ApiLogStats> {
  const params: Record<string, string> = {}
  if (startTime) params['startTime'] = toLocalDateTimeParam(startTime)
  if (endTime)   params['endTime'] = toLocalDateTimeParam(endTime)
  return apiFetch<ApiLogStats>(source, '/stats', params)
}

export async function fetchApiApps(source: ApiSource): Promise<string[]> {
  return apiFetch<string[]>(source, '/apps')
}

export async function testApiConnection(source: ApiSource): Promise<void> {
  await apiFetch(source, '', { page: '0', size: '1' })
}
