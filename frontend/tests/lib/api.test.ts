import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { api, ApiError } from '../../src/lib/api'

vi.mock('@/router', () => ({ default: { push: vi.fn() } }))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  })
}

describe('api client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('GET request returns parsed JSON', async () => {
    mockResponse({ id: 1 })
    const result = await api.get<{ id: number }>('v1/test/')
    expect(result).toEqual({ id: 1 })
  })

  it('injects Authorization header when token present', async () => {
    localStorage.setItem('access_token', 'mytoken')
    mockResponse({})
    await api.get('v1/test/')
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer mytoken')
  })

  it('throws ApiError on non-ok response', async () => {
    mockResponse({}, 404)
    await expect(api.get('v1/test/')).rejects.toThrow(ApiError)
  })

  it('DELETE request returns undefined for 204', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
    const result = await api.delete('v1/test/1/')
    expect(result).toBeUndefined()
  })

  it('ApiError carries status code', async () => {
    mockResponse({}, 403)
    try {
      await api.get('v1/test/')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(403)
    }
  })

  it('PATCH request sends correct method and body', async () => {
    mockResponse({ id: 1 })
    await api.patch('v1/test/1/', { name: 'X' })
    expect(mockFetch.mock.calls[0][1].method).toBe('PATCH')
  })

  it('retries request after successful token refresh on 401', async () => {
    localStorage.setItem('refresh_token', 'refresh-token')
    mockResponse({}, 401)                                          // initial → 401
    mockResponse({ access: 'new-access', refresh: 'new-refresh' }) // refresh → ok
    mockResponse({ id: 1 })                                        // retry → ok
    const result = await api.get<{ id: number }>('v1/test/')
    expect(result).toEqual({ id: 1 })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('logs out when refresh is also rejected with 401', async () => {
    localStorage.setItem('refresh_token', 'refresh-token')
    mockResponse({}, 401) // initial → 401
    mockResponse({}, 401) // refresh → 401
    await expect(api.get('v1/test/')).rejects.toBeInstanceOf(ApiError)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('does not log out when refresh fails with a non-401 error', async () => {
    localStorage.setItem('access_token', 'token')
    localStorage.setItem('refresh_token', 'refresh-token')
    mockResponse({}, 401) // initial → 401
    mockResponse({}, 500) // refresh → 500 (server error, not auth failure)
    await expect(api.get('v1/test/')).rejects.toBeInstanceOf(ApiError)
    expect(localStorage.getItem('access_token')).toBe('token')
  })
})
