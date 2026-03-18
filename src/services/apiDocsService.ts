/**
 * apiDocsService.ts
 *
 * Communicates with an app that exposes API documentation endpoints.
 *
 *   GET {baseUrl}/{basePath}/documents/status
 *     — Returns { enabled: boolean }. 404 means feature is disabled.
 *
 *   GET {baseUrl}/{basePath}/documents/categories
 *     — Returns a list of API documentation categories.
 *
 *   GET {baseUrl}/{basePath}/documents
 *     — Returns a paginated list of API documentation entries.
 *     Query params:
 *       keyword   string  — search across url, title, description
 *       category  string  — filter by category
 *       method    string  — HTTP method filter (GET, POST, …)
 *       page      number  — 0-based page number (default 0)
 *       size      number  — page size (default 20)
 */

import type { ApiDocsSource, ApiDocEntry, ApiDocPagedResponse } from '../types'

function resolveUrl(source: ApiDocsSource, path: string): string {
  const base = source.baseUrl.replace(/\/$/, '')
  const bp = (source.basePath || '/api/documents').replace(/\/$/, '')
  return `${base}${bp}${path}`
}

function buildHeaders(source: ApiDocsSource): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (source.apiKey) headers['X-Api-Key'] = source.apiKey
  return headers
}

async function docsFetch<T>(source: ApiDocsSource, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(resolveUrl(source, path))
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    })
  }
  const res = await fetch(url.toString(), {
    headers: buildHeaders(source),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
}

export interface ApiDocStatusResponse {
  enabled: boolean
}

/** Check whether the API docs feature is enabled on this source. */
export async function fetchApiDocsStatus(source: ApiDocsSource): Promise<ApiDocStatusResponse> {
  return docsFetch<ApiDocStatusResponse>(source, '/status')
}

/** Fetch the list of all categories. */
export async function fetchApiDocsCategories(source: ApiDocsSource): Promise<string[]> {
  return docsFetch<string[]>(source, '/categories')
}

export interface FetchApiDocsParams {
  keyword?: string
  category?: string
  method?: string
  page?: number
  size?: number
}

/** Fetch the paginated, filterable API document list. */
export async function fetchApiDocs(
  source: ApiDocsSource,
  params: FetchApiDocsParams = {},
): Promise<ApiDocPagedResponse> {
  const qp: Record<string, string> = {
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  }
  if (params.keyword)  qp['keyword']  = params.keyword
  if (params.category) qp['category'] = params.category
  if (params.method)   qp['method']   = params.method

  const raw = await docsFetch<unknown>(source, '', qp)

  // Normalise: the API may return a Spring Page or our own shape
  if (raw && typeof raw === 'object' && 'content' in raw) {
    const page = raw as ApiDocPagedResponse
    return page
  }
  // Fallback: treat as bare array
  const list = Array.isArray(raw) ? (raw as ApiDocEntry[]) : []
  return {
    content: list,
    page: 0,
    size: list.length,
    totalElements: list.length,
    totalPages: 1,
  }
}

/** Test connectivity by checking /document/status. */
export async function testApiDocsConnection(source: ApiDocsSource): Promise<void> {
  const status = await fetchApiDocsStatus(source)
  if (!status.enabled) {
    throw new Error('API Docs feature is disabled on this server (enabled: false)')
  }
}
