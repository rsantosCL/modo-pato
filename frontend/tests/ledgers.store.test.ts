import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLedgersStore } from '../src/stores/ledgers'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  })
}

const ledger = { id: '1', name: 'Familia', kind: 'shared', created_at: '', archived_at: null }

describe('ledgers store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.setItem('access_token', 'token')
    mockFetch.mockReset()
  })

  it('fetchAll populates ledgers', async () => {
    mockResponse([ledger])
    const store = useLedgersStore()
    await store.fetchAll()
    expect(store.ledgers).toHaveLength(1)
    expect(store.ledgers[0].name).toBe('Familia')
  })

  it('fetchOne sets activeLedger', async () => {
    mockResponse(ledger)
    const store = useLedgersStore()
    await store.fetchOne('1')
    expect(store.activeLedger?.name).toBe('Familia')
  })

  it('create adds ledger to list', async () => {
    mockResponse(ledger)
    const store = useLedgersStore()
    const result = await store.create('Familia', 'shared')
    expect(store.ledgers).toHaveLength(1)
    expect(result.name).toBe('Familia')
  })

  it('fetchMembers returns members list', async () => {
    const member = { user_id: '1', email: 'a@a.com', display_name: 'Alice', role: 'owner', invited_at: '', joined_at: '' }
    mockResponse([member])
    const store = useLedgersStore()
    const members = await store.fetchMembers('1')
    expect(members).toHaveLength(1)
  })

  it('createInvite returns token', async () => {
    mockResponse({ id: '1', token: 'abc123', role: 'editor', created_at: '' })
    const store = useLedgersStore()
    const result = await store.createInvite('1', 'editor')
    expect(result.token).toBe('abc123')
  })
})
