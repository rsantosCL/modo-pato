import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../src/stores/auth'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  })
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockFetch.mockReset()
  })

  it('is not authenticated by default', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('sets tokens and isAuthenticated after login', async () => {
    const auth = useAuthStore()
    mockResponse({ access: 'acc', refresh: 'ref' })
    await auth.login('alice@example.com', 'pass')
    expect(auth.isAuthenticated).toBe(true)
    expect(localStorage.getItem('access_token')).toBe('acc')
  })

  it('clears tokens on logout', async () => {
    const auth = useAuthStore()
    mockResponse({ access: 'acc', refresh: 'ref' })
    await auth.login('alice@example.com', 'pass')
    auth.logout()
    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('signup calls signup then login', async () => {
    const auth = useAuthStore()
    mockResponse({ id: '1', email: 'alice@example.com', display_name: 'Alice', created_at: '' })
    mockResponse({ access: 'acc', refresh: 'ref' })
    await auth.signup('alice@example.com', 'pass', 'Alice')
    expect(auth.isAuthenticated).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('refresh updates access token', async () => {
    const auth = useAuthStore()
    mockResponse({ access: 'acc', refresh: 'ref' })
    await auth.login('alice@example.com', 'pass')
    mockResponse({ access: 'new-acc', refresh: 'new-ref' })
    await auth.refresh()
    expect(localStorage.getItem('access_token')).toBe('new-acc')
  })
})
