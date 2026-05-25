import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api, ApiError } from '../src/lib/api'

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
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' }),
    })
    await expect(api.get('v1/test/')).rejects.toThrow(ApiError)
  })

  it('DELETE request returns undefined for 204', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
    const result = await api.delete('v1/test/1/')
    expect(result).toBeUndefined()
  })

  it('ApiError carries status code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Forbidden' }),
    })
    try {
      await api.get('v1/test/')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(403)
    }
  })
})
