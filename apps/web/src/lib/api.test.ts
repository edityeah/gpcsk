import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api, type ApiError } from './api.js'

const ORIGINAL_FETCH = global.fetch

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  global.fetch = ORIGINAL_FETCH
})

describe('api', () => {
  it('GET parses JSON body on 200', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const out = await api<{ status: string }>('/health')
    expect(out.status).toBe('ok')
  })

  it('POST sends JSON and attaches bearer token when provided', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }))
    await api('/api/auth/phone/verify-otp', { method: 'POST', body: { phone: '9000000005', otp: '1234' }, token: 'tkn' })
    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tkn')
    expect(init.body).toBe(JSON.stringify({ phone: '9000000005', otp: '1234' }))
  })

  it('throws ApiError with status on non-2xx', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_otp' }), { status: 401, headers: { 'content-type': 'application/json' } }),
    )
    await expect(api('/api/auth/phone/verify-otp', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 401,
      code: 'invalid_otp',
    } satisfies Partial<ApiError>)
  })
})
