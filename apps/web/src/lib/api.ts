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

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

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
