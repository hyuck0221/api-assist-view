// ─── Core log entry model (mirrors ApiLogEntry from the Spring Boot library) ───

export interface ApiLogEntry {
  id: string
  appName: string | null    // application name (set by apilog.app-name property)
  url: string
  method: HttpMethod
  queryParams: Record<string, string[]>
  requestHeaders: Record<string, string>
  requestBody: string | null
  responseStatus: number
  responseContentType: string | null
  responseBody: string | null
  requestTime: string   // ISO 8601
  responseTime: string  // ISO 8601
  processingTimeMs: number
  serverName: string | null
  serverPort: number | null
  remoteAddr: string | null
  // Added by frontend: which source this entry came from
  _sourceId?: string
  _sourceName?: string
  _sourceColor?: string
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | string

// ─── Paginated response (from API source) ────────────────────────────────────

export interface PagedResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

// ─── Stats response (from API source) ────────────────────────────────────────

export interface ApiLogStats {
  totalCount: number
  avgProcessingTimeMs: number
  maxProcessingTimeMs: number
  p99ProcessingTimeMs: number
  countByStatus: Record<string, number>    // HTTP status code → count
  countByMethod: Record<string, number>    // HTTP method → count
  countByAppName: Record<string, number>   // app name → count
}

// ─── Log sources ─────────────────────────────────────────────────────────────

export type SourceType = 'supabase' | 'supabase-s3' | 'api' | 'file' | 'api-docs'

export interface BaseSource {
  id: string
  name: string
  type: SourceType
  enabled: boolean
  color: string
}

/**
 * Supabase source: direct database connection using @supabase/supabase-js.
 * Queries the api_logs table directly.
 */
export interface SupabaseSource extends BaseSource {
  type: 'supabase'
  url: string         // e.g., https://xxxx.supabase.co
  anonKey: string
  tableName: string   // default: api_logs
}

/**
 * API source: connects to a Spring Boot app running the apilog library.
 * The library must expose the /api/* endpoints.
 *
 * Designed API endpoints (to be implemented in the library):
 *   GET /api/logs           - paginated log list
 *   GET /api/logs/:id       - single log entry
 *   GET /api/logs/stats     - statistics
 */
export interface ApiSource extends BaseSource {
  type: 'api'
  baseUrl: string          // e.g., http://localhost:8080
  basePath: string         // e.g., /api (default)
  apiKey?: string          // sent as X-Api-Key header
  extraHeaders?: Record<string, string>
}

/**
 * Supabase S3 source: fetches JSONL / CSV log files from Supabase Storage
 * (S3-compatible bucket) written by ApiLogSupabaseS3Storage.
 * Files are listed from the bucket, downloaded, and parsed in the browser.
 */
export interface SupabaseS3Source extends BaseSource {
  type: 'supabase-s3'
  url: string         // e.g., https://xxxx.supabase.co
  anonKey: string     // service role key recommended for storage access
  bucket: string      // default: api-logs
  keyPrefix: string   // default: logs/
  format: 'json' | 'csv'
  maxFiles: number    // how many recent files to load (default: 5)
}

/**
 * Local File source: connects to a Spring Boot app running the apilog library
 * with local-file storage enabled.
 *
 * When directory/format/maxFiles are set, the frontend lists and downloads
 * actual log files via the /api/logs/files endpoints, then parses them in the
 * browser (same as Supabase S3 mode).
 *
 * When those fields are absent, it falls back to the standard paginated API
 * endpoints (same as ApiSource).
 *
 * Use this when: local-file storage is enabled in the Spring Boot app.
 */
export interface FileSource extends BaseSource {
  type: 'file'
  baseUrl: string       // e.g., http://localhost:8080
  basePath: string      // e.g., /api (default)
  apiKey?: string       // sent as X-Api-Key header
  directory?: string    // log file directory on the server, e.g. "logs/"
  format?: 'json' | 'csv'
  maxFiles?: number     // how many recent files to load (default: 5)
}

/**
 * API Docs source: connects to an app exposing API documentation endpoints.
 *
 *   GET {baseUrl}/{basePath}/documents/status      — check if enabled
 *   GET {baseUrl}/{basePath}/documents/categories  — category list
 *   GET {baseUrl}/{basePath}/documents             — paginated, searchable API list
 */
export interface ApiDocsSource extends BaseSource {
  type: 'api-docs'
  baseUrl: string   // e.g., http://localhost:8080
  basePath: string  // e.g., /api (default)
  apiKey?: string   // sent as X-Api-Key header
}

// ─── API Doc entry (returned by GET {basePath}/document) ─────────────────────

export interface ApiDocParam {
  path: string
  type: string
  description: string
  nullable: boolean
  parameterType: 'PATH' | 'QUERY' | 'BODY' | 'HEADER' | 'COOKIE' | null
}

export interface ApiDocEntry {
  id?: string
  url: string
  method: HttpMethod
  title?: string | null
  description?: string | null
  category?: string | null
  requestSchema?: Record<string, any> | null
  responseSchema?: Record<string, any> | null
  requestInfos?: ApiDocParam[]
  responseInfos?: ApiDocParam[]
}

export interface ApiDocPagedResponse {
  content: ApiDocEntry[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type LogSource = SupabaseSource | SupabaseS3Source | ApiSource | FileSource | ApiDocsSource

// ─── Filter & query state ────────────────────────────────────────────────────

export interface LogFilters {
  appName?: string           // exact match on application name
  url?: string               // partial match; supports % wildcard
  method?: string            // HTTP method
  statusCode?: string        // exact status code (as string for API param)
  startTime?: string         // ISO date string
  endTime?: string           // ISO date string
  minProcessingTimeMs?: number
  remoteAddr?: string        // used by file/supabase sources
  serverName?: string        // used by file/supabase sources
  sourceIds?: string[]       // filter by specific source IDs
}

export interface SortConfig {
  field: keyof ApiLogEntry
  direction: 'asc' | 'desc'
}

export interface QueryParams extends LogFilters {
  page: number
  size: number
  sort: SortConfig
}

// ─── UI state types ───────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'

export type SourceLoadState = 'idle' | 'loading' | 'success' | 'error'

export interface SourceStatus {
  sourceId: string
  state: SourceLoadState
  error?: string
  lastFetched?: Date
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export const SOURCE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
] as const

export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400'
  if (status >= 300 && status < 400) return 'text-blue-600 dark:text-blue-400'
  if (status >= 400 && status < 500) return 'text-yellow-600 dark:text-yellow-400'
  if (status >= 500) return 'text-red-600 dark:text-red-400'
  return 'text-gray-600 dark:text-gray-400'
}

export function getStatusBadgeClass(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  if (status >= 300 && status < 400) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  if (status >= 400 && status < 500) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  if (status >= 500) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
}

export function getMethodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400'
    case 'POST':   return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'PUT':    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'PATCH':  return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
    case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    default:       return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
  }
}
