# api-assist-view

**Vite + React + TypeScript + TailwindCSS**로 만든 멀티 소스 API 로그 뷰어입니다.
[apilog](https://github.com/hyuck0221/apilog) Spring Boot / Kotlin 라이브러리의 전용 프론트엔드입니다.

[English](./README.md)

---

## 주요 기능

- **멀티 애플리케이션 대시보드** — 여러 애플리케이션의 로그를 하나의 화면에서 통합 조회
- **세 가지 소스 타입** — Spring Boot API, Supabase (직접 DB 조회), 로컬 파일 업로드
- **`appName` 필터** — 하나의 서버에 여러 앱이 로그를 보내는 경우 애플리케이션별 필터링 가능
- **실시간 필터링** — URL (`%` 와일드카드 지원), HTTP 메서드, 상태 코드, 시간 범위, 응답 시간, IP
- **통합 로그 테이블** — 모든 활성 소스의 결과를 병합·정렬, 소스별 색상 표시
- **로그 상세 패널** — 요청/응답 헤더, 바디, 쿼리 파라미터 전체 확인
- **소스별 통계** — 소스마다 총 건수, 평균 응답 시간, 에러율, 상위 URL 표시
- **다크 / 라이트 모드** — 시스템 설정을 따르며 헤더에서 토글 가능
- **설정 영속성** — 소스 설정이 `localStorage`에 자동 저장

---

## 시작하기

### 사전 조건

- Node.js 18 이상

### 설치

```bash
git clone <repo-url>
cd api-assist-view
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열면 됩니다.

---

## 소스 설정

**Settings** → **Add Source**에서 소스 타입을 선택합니다.

### 소스 타입

#### 1. Spring Boot API (`api`)

`apilog` 뷰어 모듈을 사용하는 Spring Boot 애플리케이션에 연결합니다.

| 필드 | 설명 |
|---|---|
| Base URL | 앱의 루트 URL (예: `http://localhost:8080`) |
| API Key | 선택 사항 — `X-Api-Key` 헤더로 전송됩니다 |

> apilog 라이브러리의 뷰어 모듈이 필요한 엔드포인트를 자동으로 노출합니다.
> `apilog.view.base-path` 설정으로 기본 경로를 변경할 수 있습니다 (기본값: `/apilog`).

#### 2. Supabase DB (`supabase`)

`@supabase/supabase-js`를 통해 Supabase PostgreSQL의 `api_logs` 테이블을 직접 조회합니다.
apilog 라이브러리가 `apilog.storage.db.enabled=true`로 Supabase DB에 저장 중일 때 사용합니다.

| 필드 | 설명 |
|---|---|
| Project URL | `https://xxxx.supabase.co` |
| Anon / Service Role Key | Supabase API 키 |
| Table Name | 기본값: `api_logs` |

#### 3. Supabase Storage (`supabase-s3`)

`ApiLogSupabaseS3Storage`가 Supabase Storage 버킷에 저장한 JSONL/CSV 파일을 내려받아 파싱합니다.
파일 목록을 조회하고 브라우저에서 다운로드·파싱하므로 별도 서버가 필요 없습니다.

| 필드 | 설명 |
|---|---|
| Project URL | `https://xxxx.supabase.co` |
| Service Role Key | Storage 버킷 접근을 위해 서비스 롤 키 권장 |
| Bucket | 기본값: `api-logs` |
| Key Prefix | 기본값: `logs/` |
| File Format | `json` (JSONL) 또는 `csv` |
| Max Recent Files | 최근 파일을 몇 개까지 로드할지 (기본값: 5) |

#### 4. 로컬 파일 (`file`)

라이브러리의 로컬 파일 저장 백엔드가 생성한 **JSONL** 또는 **CSV** 파일을 직접 업로드합니다.
파싱은 브라우저에서만 이루어지며 데이터가 외부로 전송되지 않습니다.

---

## API 명세 (Spring Boot apilog 뷰어 모듈)

### `GET {basePath}/logs`

페이지네이션 및 필터링된 로그 목록을 반환합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `appName` | string | — | 애플리케이션 이름 정확 일치 |
| `method` | string | — | HTTP 메서드 (GET, POST, …) |
| `url` | string | — | URL 경로; `%` 와일드카드 지원 (SQL LIKE) |
| `statusCode` | integer | — | HTTP 응답 상태 코드 (정확 일치) |
| `startTime` | ISO-8601 | — | `requestTime` 하한 |
| `endTime` | ISO-8601 | — | `requestTime` 상한 |
| `minProcessingTimeMs` | long | — | 최소 처리 시간 (ms) |
| `page` | integer | `0` | 페이지 번호 (0 기반) |
| `size` | integer | `20` | 페이지 크기 (최대 200) |
| `sortBy` | string | `request_time` | `request_time` \| `processing_time_ms` \| `response_status` \| `url` \| `method` \| `app_name` |
| `sortDir` | string | `DESC` | `ASC` \| `DESC` |

**응답 (`ApiLogPage`):**

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

ID로 단일 `ApiLogEntry`를 반환합니다. 없으면 `404`를 응답합니다.

### `GET {basePath}/logs/stats`

집계 통계를 반환합니다. `startTime`, `endTime`으로 기간 범위를 지정할 수 있습니다.

**응답 (`ApiLogStats`):**

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

로그를 전송한 애플리케이션 이름의 정렬된 목록을 반환합니다.
프론트엔드에서 앱 이름 필터 드롭다운을 자동으로 채우는 데 사용됩니다.

**응답:** `["app-a", "app-b", "app-c"]`

### `POST {basePath}/logs/receive`

HTTP 수신 엔드포인트. 다음과 같이 설정한 원격 서비스에서 호출됩니다:

```yaml
apilog:
  storage:
    http:
      enabled: true
      endpoint-url: http://<뷰어서버>/apilog/logs/receive
```

---

## ApiLogEntry 스키마

```typescript
interface ApiLogEntry {
  id: string
  appName: string | null       // apilog.app-name 설정값 (소스 애플리케이션에서 지정)
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

### DB 컬럼 매핑 (Supabase / PostgreSQL)

| TypeScript 필드 | DB 컬럼 |
|---|---|
| `appName` | `app_name` |
| `queryParams` | `query_params` (JSON 문자열) |
| `requestHeaders` | `request_headers` (JSON 문자열) |
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

## 기술 스택

| 라이브러리 | 버전 | 용도 |
|---|---|---|
| Vite | 6 | 빌드 도구 |
| React | 19 | UI 프레임워크 |
| TypeScript | 5.7 | 타입 안전성 |
| TailwindCSS | 3 | 스타일링 |
| React Router | 7 | 라우팅 |
| TanStack Query | 5 | 데이터 페칭 & 캐싱 |
| Zustand | 5 | 상태 관리 |
| Supabase JS | 2 | Supabase 클라이언트 |
| date-fns | 4 | 날짜 포맷 |
| lucide-react | — | 아이콘 |
| clsx | — | 클래스명 유틸리티 |

---

## 프로젝트 구조

```
src/
├── components/
│   ├── layout/         # Header, Sidebar, Layout 래퍼
│   ├── logs/           # LogTable, LogFilters, LogDetail
│   ├── settings/       # SourceForm, SourceCard
│   └── stats/          # StatsBar (소스별 통계)
├── hooks/
│   ├── useLogs.ts      # 멀티 소스 데이터 페칭 & 병합
│   └── useAppNames.ts  # 앱 이름 목록 조회 (드롭다운용)
├── pages/
│   ├── LogsPage.tsx
│   └── SettingsPage.tsx
├── services/
│   ├── supabaseService.ts
│   ├── apiService.ts
│   └── fileService.ts
├── stores/
│   ├── sourceStore.ts  # 소스 설정 (localStorage 영속)
│   ├── filterStore.ts  # 활성 필터 & 페이지네이션
│   └── themeStore.ts   # 다크/라이트 모드 (localStorage 영속)
└── types/
    └── index.ts        # 공유 TypeScript 인터페이스
```

---

## 라이선스

MIT
