/**
 * fileApiService.ts
 *
 * Fetches log files from a Spring Boot app that stores logs as local files
 * (apilog.storage.local-file.enabled=true).
 *
 * Required server endpoints (see API design below):
 *
 *   GET {basePath}/logs/files
 *     Query params:
 *       directory  string   — log directory, e.g. "logs/"
 *       maxFiles   number   — max recent files to return (default 5)
 *       format     string   — "json" | "csv"
 *     Response 200: FileEntry[]
 *       [{ "name": "2024-01-15.jsonl", "path": "logs/2024-01-15.jsonl",
 *          "size": 102400, "lastModified": "2024-01-15T23:59:59Z" }, ...]
 *
 *   GET {basePath}/logs/files/content
 *     Query params:
 *       path       string   — relative file path from the listing (e.g. "logs/2024-01-15.jsonl")
 *     Response 200: text/plain  (raw JSONL or CSV content)
 */

import type { ApiLogEntry, ApiLogStats, FileSource, LogFilters, PagedResponse, SortConfig } from '../types'
import { filterAndPage } from './fileService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string          // filename only, e.g. "2024-01-15.jsonl"
  path: string          // full relative path, e.g. "logs/2024-01-15.jsonl"
  size: number          // bytes
  lastModified: string  // ISO-8601
}

// ─── In-memory cache (per-source) ─────────────────────────────────────────────

const fileCache = new Map<string, { entries: ApiLogEntry[]; fetchedAt: number; tick: number }>()
const CACHE_TTL_MS = 30_000  // 30 s

export function invalidateFileCache(sourceId: string) {
  fileCache.delete(sourceId)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHeaders(source: FileSource): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (source.apiKey) headers['X-Api-Key'] = source.apiKey
  return headers
}

function resolveUrl(source: FileSource, path: string): string {
  const base = source.baseUrl.replace(/\/$/, '')
  const bp = (source.basePath || '/api/logs').replace(/\/$/, '')
  return `${base}${bp}${path}`
}

// ─── File listing ──────────────────────────────────────────────────────────────

async function listFiles(source: FileSource): Promise<FileEntry[]> {
  const url = new URL(resolveUrl(source, '/files'))
  if (source.directory) url.searchParams.set('directory', source.directory)
  if (source.maxFiles)  url.searchParams.set('maxFiles', String(source.maxFiles))
  if (source.format)    url.searchParams.set('format', source.format)

  const res = await fetch(url.toString(), { headers: buildHeaders(source) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}: ${text || res.statusText}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<FileEntry[]>
}

// ─── File content download + parse ────────────────────────────────────────────

async function downloadFileContent(source: FileSource, filePath: string): Promise<string> {
  const url = new URL(resolveUrl(source, '/files/content'))
  url.searchParams.set('path', filePath)

  const res = await fetch(url.toString(), {
    headers: { ...buildHeaders(source) as Record<string, string>, Accept: 'text/plain' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}: ${text || res.statusText}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.text()
}

function _parseSync(text: string, format: 'json' | 'csv'): ApiLogEntry[] {
  if (format === 'csv') return _parseCsv(text)
  return _parseJsonl(text)
}

function _parseJsonl(text: string): ApiLogEntry[] {
  const entries: ApiLogEntry[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      entries.push(_normalize(JSON.parse(trimmed)))
    } catch { /* skip malformed lines */ }
  }
  return entries
}

function _parseCsv(text: string): ApiLogEntry[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = _csvRow(lines[0]!).map(h => h.trim())
  const entries: ApiLogEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = _csvRow(lines[i]!)
    if (values.length < 2) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: Record<string, any> = {}
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? '' })
    try { entries.push(_normalize(obj)) } catch { /* skip */ }
  }
  return entries
}

function _csvRow(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) { values.push(current); current = '' }
    else current += ch
  }
  values.push(current)
  return values
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _normalize(obj: Record<string, any>): ApiLogEntry {
  return {
    id: String(obj.id ?? crypto.randomUUID()),
    appName: obj.appName ?? obj.app_name ?? null,
    url: String(obj.url ?? ''),
    method: String(obj.method ?? 'GET'),
    queryParams: _json(obj.queryParams ?? obj.query_params) ?? {},
    requestHeaders: _json(obj.requestHeaders ?? obj.request_headers) ?? {},
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
function _json(value: any): any {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function loadAllEntries(source: FileSource, refreshTick = 0): Promise<ApiLogEntry[]> {
  const cached = fileCache.get(source.id)
  if (cached && cached.tick === refreshTick && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entries
  }

  const files = await listFiles(source)
  const format = source.format ?? 'json'

  const results = await Promise.allSettled(
    files.map(f => downloadFileContent(source, f.path))
  )

  const entries: ApiLogEntry[] = []
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      entries.push(..._parseSync(r.value, format))
    }
  })

  // Sort newest first
  entries.sort((a, b) => b.requestTime.localeCompare(a.requestTime))

  fileCache.set(source.id, { entries, fetchedAt: Date.now(), tick: refreshTick })
  return entries
}

export async function fetchFileApiLogs(
  source: FileSource,
  filters: LogFilters,
  sort: SortConfig,
  page: number,
  pageSize: number,
  refreshTick = 0,
): Promise<PagedResponse<ApiLogEntry>> {
  const entries = await loadAllEntries(source, refreshTick)
  return filterAndPage(entries, filters, sort, page, pageSize)
}

export async function fetchFileApiStats(source: FileSource, refreshTick = 0): Promise<ApiLogStats> {
  const entries = await loadAllEntries(source, refreshTick)

  const totalCount = entries.length
  const times = entries.map(e => e.processingTimeMs ?? 0).sort((a, b) => a - b)
  const avgProcessingTimeMs = totalCount > 0
    ? Math.round(times.reduce((s, v) => s + v, 0) / totalCount)
    : 0
  const maxProcessingTimeMs = times[times.length - 1] ?? 0
  const p99Idx = Math.max(0, Math.ceil(totalCount * 0.99) - 1)
  const p99ProcessingTimeMs = times[p99Idx] ?? 0

  const countByStatus: Record<string, number> = {}
  const countByMethod: Record<string, number> = {}
  const countByAppName: Record<string, number> = {}

  for (const e of entries) {
    const s = String(e.responseStatus)
    countByStatus[s] = (countByStatus[s] ?? 0) + 1
    countByMethod[e.method] = (countByMethod[e.method] ?? 0) + 1
    if (e.appName) countByAppName[e.appName] = (countByAppName[e.appName] ?? 0) + 1
  }

  return { totalCount, avgProcessingTimeMs, maxProcessingTimeMs, p99ProcessingTimeMs, countByStatus, countByMethod, countByAppName }
}

export async function testFileApiConnection(source: FileSource): Promise<void> {
  await listFiles({ ...source, maxFiles: 1 })
}
