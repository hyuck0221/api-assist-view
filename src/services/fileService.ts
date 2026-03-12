/**
 * fileService.ts
 *
 * Parses JSONL and CSV files written by the apilog library's
 * ApiLogLocalFileStorage or ApiLogSupabaseS3Storage backends.
 *
 * JSONL format: one JSON object per line
 * CSV format:   header row + data rows (the same fields as the JSONL format)
 */

import type { ApiLogEntry } from '../types'

export async function parseLogFile(file: File): Promise<ApiLogEntry[]> {
  const text = await file.text()
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.csv')) {
    return parseCsv(text)
  }
  // .json, .jsonl, .ndjson
  return parseJsonl(text)
}

// ─── JSONL parser ─────────────────────────────────────────────────────────────

function parseJsonl(text: string): ApiLogEntry[] {
  const entries: ApiLogEntry[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const obj = JSON.parse(trimmed)
      entries.push(normalizeEntry(obj))
    } catch {
      // skip malformed lines
    }
  }
  return entries
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  'id', 'url', 'method', 'queryParams', 'requestHeaders',
  'requestBody', 'responseStatus', 'responseContentType', 'responseBody',
  'requestTime', 'responseTime', 'processingTimeMs',
  'serverName', 'serverPort', 'remoteAddr',
] as const

function parseCsv(text: string): ApiLogEntry[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvRow(lines[0]!).map(h => h.trim())
  const entries: ApiLogEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i]!)
    if (values.length < 2) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: Record<string, any> = {}
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? '' })
    try {
      entries.push(normalizeEntry(obj))
    } catch {
      // skip
    }
  }
  return entries
}

function parseCsvRow(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  values.push(current)
  return values
}

// ─── Normalization ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEntry(obj: Record<string, any>): ApiLogEntry {
  return {
    id: String(obj.id ?? crypto.randomUUID()),
    appName: obj.appName ?? obj.app_name ?? null,
    url: String(obj.url ?? ''),
    method: String(obj.method ?? 'GET'),
    queryParams: parseJsonField(obj.queryParams ?? obj.query_params) ?? {},
    requestHeaders: parseJsonField(obj.requestHeaders ?? obj.request_headers) ?? {},
    requestBody: obj.requestBody ?? obj.request_body ?? null,
    responseStatus: Number(obj.responseStatus ?? obj.response_status ?? 0),
    responseContentType: obj.responseContentType ?? obj.response_content_type ?? null,
    responseBody: obj.responseBody ?? obj.response_body ?? null,
    requestTime: String(obj.requestTime ?? obj.request_time ?? ''),
    responseTime: String(obj.responseTime ?? obj.response_time ?? ''),
    processingTimeMs: Number(obj.processingTimeMs ?? obj.processing_time_ms ?? 0),
    serverName: obj.serverName ?? obj.server_name ?? null,
    serverPort: obj.serverPort != null ? Number(obj.serverPort) : (obj.server_port != null ? Number(obj.server_port) : null),
    remoteAddr: obj.remoteAddr ?? obj.remote_addr ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonField(value: any): any {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

// ─── Client-side filtering ────────────────────────────────────────────────────

import type { LogFilters, SortConfig, PagedResponse } from '../types'

export function filterAndPage(
  entries: ApiLogEntry[],
  filters: LogFilters,
  sort: SortConfig,
  page: number,
  pageSize: number,
): PagedResponse<ApiLogEntry> {
  let filtered = entries

  if (filters.appName) {
    filtered = filtered.filter(e => e.appName === filters.appName)
  }
  if (filters.url) {
    // Support % wildcard same as the backend
    if (filters.url.includes('%')) {
      const pattern = new RegExp(filters.url.replace(/%/g, '.*'), 'i')
      filtered = filtered.filter(e => pattern.test(e.url))
    } else {
      const u = filters.url.toLowerCase()
      filtered = filtered.filter(e => e.url.toLowerCase().includes(u))
    }
  }
  if (filters.method) {
    const m = filters.method.toUpperCase()
    filtered = filtered.filter(e => e.method.toUpperCase() === m)
  }
  if (filters.statusCode) {
    filtered = filtered.filter(e => matchStatus(e.responseStatus, filters.statusCode!))
  }
  if (filters.startTime) {
    const t = new Date(filters.startTime).getTime()
    filtered = filtered.filter(e => new Date(e.requestTime).getTime() >= t)
  }
  if (filters.endTime) {
    const t = new Date(filters.endTime).getTime()
    filtered = filtered.filter(e => new Date(e.requestTime).getTime() <= t)
  }
  if (filters.minProcessingTimeMs !== undefined) {
    filtered = filtered.filter(e => e.processingTimeMs >= filters.minProcessingTimeMs!)
  }
  if (filters.remoteAddr) {
    const r = filters.remoteAddr.toLowerCase()
    filtered = filtered.filter(e => e.remoteAddr?.toLowerCase().includes(r))
  }
  if (filters.serverName) {
    const s = filters.serverName.toLowerCase()
    filtered = filtered.filter(e => e.serverName?.toLowerCase().includes(s))
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aVal = (a as any)[sort.field]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bVal = (b as any)[sort.field]
    if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
    return 0
  })

  const totalElements = filtered.length
  const from = page * pageSize
  const content = filtered.slice(from, from + pageSize)

  return {
    content,
    page,
    size: pageSize,
    totalElements,
    totalPages: Math.ceil(totalElements / pageSize),
  }
}

function matchStatus(actual: number, filter: string): boolean {
  if (filter === '2xx') return actual >= 200 && actual < 300
  if (filter === '3xx') return actual >= 300 && actual < 400
  if (filter === '4xx') return actual >= 400 && actual < 500
  if (filter === '5xx') return actual >= 500 && actual < 600
  if (/^\d+$/.test(filter)) return actual === parseInt(filter)
  return true
}

// ─── Reference CSV columns list (for documentation) ──────────────────────────
export { CSV_COLUMNS }
