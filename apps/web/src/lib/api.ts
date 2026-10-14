export interface ApiError {
  status: number
  code?: string
  message: string
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
}

// VITE_API_URL may be:
//   - an absolute origin  → API hosted separately (Docker/tunnel setup)
//   - an empty string     → same-origin (API serves the SPA, e.g. Render)
//   - unset               → dev falls back to the local API; prod = same-origin
const BASE = (
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : import.meta.env.DEV ? 'http://localhost:8001' : ''
).replace(/\/$/, '')

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })

  const ct = res.headers.get('content-type') ?? ''
  const parsed = ct.includes('application/json') ? await res.json().catch(() => ({})) : {}

  if (!res.ok) {
    const err: ApiError = { status: res.status, code: parsed.error, message: parsed.message ?? res.statusText }
    throw err
  }
  return parsed as T
}
