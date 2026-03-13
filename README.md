# api-assist-view

A multi-source API log viewer built with **Vite + React + TypeScript + TailwindCSS**.
Companion frontend for the [apilog](https://github.com/hyuck0221/spring-api-assist) Spring Boot / Kotlin library.

[한국어](./README-ko.md)

---

## Features

- **Multi-application dashboard** — View logs from multiple applications in a single unified screen
- **Three source types** — Spring Boot API, Supabase (direct DB), or local file upload
- **`appName` filter** — When multiple apps send logs to the same server, filter by application name
- **Real-time filtering** — URL (with `%` wildcard), HTTP method, status code, time range, duration, IP
- **Unified log table** — Merged and sorted results from all active sources with color-coded indicators
- **Log detail panel** — Inspect request/response headers, bodies, query params in full
- **Per-source stats** — Total count, avg duration, error rate, top URLs per source
- **Dark / light mode** — Follows system preference, toggleable from the header
- **Persistent configuration** — Source configs saved to `localStorage`

---

## Getting Started

### Prerequisites

- Node.js 18+

### Installation

```bash
git clone <repo-url>
cd api-assist-view
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuring Sources

Go to **Settings** → **Add Source** and choose a source type.

### Source Types

#### 1. Spring Boot API (`api`)

Connects to a Spring Boot application running the apilog library.

| Field | Description |
|---|---|
| Base URL | Root URL of the app, e.g. `http://localhost:8080` |
| Base Path | API base path, default: `/api` |
| API Key | Optional — sent as `X-Api-Key` header |

#### 2. Supabase DB (`supabase`)

Queries the `api_logs` table directly in your Supabase PostgreSQL database via `@supabase/supabase-js`.
Use this when the library is configured with Supabase DB storage enabled.

| Field | Description |
|---|---|
| Project URL | `https://xxxx.supabase.co` |
| Anon / Service Role Key | Supabase API key |
| Table Name | Default: `api_logs` |

#### 3. Supabase Storage (`supabase-s3`)

Downloads and parses JSONL/CSV log files stored in a Supabase Storage bucket by `ApiLogSupabaseS3Storage`.
Files are listed from the bucket, downloaded in the browser, and parsed locally.

| Field | Description |
|---|---|
| Project URL | `https://xxxx.supabase.co` |
| Service Role Key | Recommended for Storage bucket access |
| Bucket | Default: `api-logs` |
| Key Prefix | Default: `logs/` |
| File Format | `json` (JSONL) or `csv` |
| Max Recent Files | How many of the most recent files to load (default: 5) |

#### 4. Local File (`file`)

Upload a **JSONL** or **CSV** file exported by the library's local file storage backend.
Parsing happens entirely in the browser — no data leaves your machine.

---

## API Specification

### `GET {basePath}/logs`

Returns a paginated, filtered list of log entries.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `appName` | string | — | Exact match on application name |
| `method` | string | — | HTTP method (GET, POST, …) |
| `url` | string | — | URL path; supports `%` wildcard (SQL LIKE) |
| `statusCode` | integer | — | HTTP response status code (exact) |
| `startTime` | ISO-8601 | — | Lower bound for `requestTime` |
| `endTime` | ISO-8601 | — | Upper bound for `requestTime` |
| `minProcessingTimeMs` | long | — | Minimum processing time (ms) |
| `page` | integer | `0` | Page index (0-based) |
| `size` | integer | `20` | Page size (max 200) |
| `sortBy` | string | `request_time` | `request_time` \| `processing_time_ms` \| `response_status` \| `url` \| `method` \| `app_name` |
| `sortDir` | string | `DESC` | `ASC` \| `DESC` |

**Response (`ApiLogPage`):**

```json
{
  "content": [ /* ApiLogEntry[] */ ],
  "number": 0,
  "size": 20,
  "totalElements": 1234,
  "totalPages": 62
}
```

### `GET {basePath}/logs/:id`

Returns a single `ApiLogEntry`. Responds `404` if not found.

### `GET {basePath}/logs/stats`

Returns aggregate statistics, optionally scoped to a time range.

**Query parameters:** `startTime`, `endTime` (ISO-8601, optional)

**Response (`ApiLogStats`):**

```json
{
  "totalCount": 5000,
  "avgProcessingTimeMs": 42.3,
  "statusDistribution": { "200": 4500, "404": 300, "500": 200 },
  "methodDistribution": { "GET": 3000, "POST": 1500, "PUT": 500 },
  "topUrls": [
    { "url": "/api/users", "count": 800 }
  ],
  "recentErrorRate": 0.04
}
```

### `GET {basePath}/logs/apps`

Returns a sorted list of distinct application names that have submitted logs.
Used to populate the app-name filter dropdown automatically.

**Response:** `["app-a", "app-b", "app-c"]`

### `GET {basePath}/logs/files`

Returns a list of log files from local file storage.

**Query parameters:** `directory`, `maxFiles`, `format` (optional)

### `GET {basePath}/logs/files/content`

Returns the raw content of a specific log file.

**Query parameters:** `path` (required)

### `GET {basePath}/documents/status`

Returns `{ "enabled": true }` if the API Docs feature is active.

### `GET {basePath}/documents/categories`

Returns a list of distinct API documentation categories.

### `GET {basePath}/documents`

Returns a paginated, searchable list of API documentation entries.

**Query parameters:** `keyword`, `category`, `method`, `page`, `size`

### `POST {basePath}/logs/receive`

HTTP ingestion endpoint — called by remote services to push logs.

---

## ApiLogEntry Schema

```typescript
interface ApiLogEntry {
  id: string
  appName: string | null       // set by apilog.app-name in the source application
  url: string
  method: string               // GET | POST | PUT | PATCH | DELETE | …
  queryParams: Record<string, string[]>
  requestHeaders: Record<string, string>
  requestBody: string | null
  responseStatus: number
  responseContentType: string | null
  responseBody: string | null
  requestTime: string          // ISO 8601
  responseTime: string         // ISO 8601
  processingTimeMs: number
  serverName: string | null
  serverPort: number | null
  remoteAddr: string | null
}
```

### DB column mapping (Supabase / PostgreSQL)

| TypeScript field | DB column |
|---|---|
| `appName` | `app_name` |
| `queryParams` | `query_params` (JSON string) |
| `requestHeaders` | `request_headers` (JSON string) |
| `requestBody` | `request_body` |
| `responseStatus` | `response_status` |
| `responseContentType` | `response_content_type` |
| `responseBody` | `response_body` |
| `requestTime` | `request_time` |
| `responseTime` | `response_time` |
| `processingTimeMs` | `processing_time_ms` |
| `serverName` | `server_name` |
| `serverPort` | `server_port` |
| `remoteAddr` | `remote_addr` |

---

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| Vite | 6 | Build tool |
| React | 19 | UI framework |
| TypeScript | 5.7 | Type safety |
| TailwindCSS | 3 | Styling |
| React Router | 7 | Routing |
| TanStack Query | 5 | Data fetching & caching |
| Zustand | 5 | State management |
| Supabase JS | 2 | Supabase client |
| date-fns | 4 | Date formatting |
| lucide-react | — | Icons |
| clsx | — | Class name utility |

---

## Project Structure

```
src/
├── components/
│   ├── layout/         # Header, Sidebar, Layout wrapper
│   ├── logs/           # LogTable, LogFilters, LogDetail
│   ├── settings/       # SourceForm, SourceCard
│   └── stats/          # StatsBar (per-source statistics)
├── hooks/
│   ├── useLogs.ts      # Multi-source data fetching & merging
│   └── useAppNames.ts  # Fetch distinct app names for dropdown
├── pages/
│   ├── LogsPage.tsx
│   └── SettingsPage.tsx
├── services/
│   ├── supabaseService.ts
│   ├── apiService.ts
│   └── fileService.ts
├── stores/
│   ├── sourceStore.ts  # Source config (persisted to localStorage)
│   ├── filterStore.ts  # Active filters & pagination
│   └── themeStore.ts   # Dark/light mode (persisted to localStorage)
└── types/
    └── index.ts        # Shared TypeScript interfaces
```

---

## License

MIT
