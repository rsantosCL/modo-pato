import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLedgersStore } from '../../src/stores/ledgers'

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
    store.activeLedger = ledger
    const members = await store.fetchMembers('1')
    expect(members).toHaveLength(1)
  })

  it('fetchMembers fetches ledger first when id does not match activeLedger', async () => {
    const other = { ...ledger, id: '2', name: 'Personal' }
    mockResponse(other)
    mockResponse([])
    const store = useLedgersStore()
    store.activeLedger = ledger
    await store.fetchMembers('2')
    expect(store.activeLedger?.id).toBe('2')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('createInvite returns token', async () => {
    mockResponse({ id: '1', token: 'abc123', role: 'editor', created_at: '' })
    const store = useLedgersStore()
    const result = await store.createInvite('1', 'editor')
    expect(result.token).toBe('abc123')
  })

  it('update patches ledger and syncs store', async () => {
    const updated = { ...ledger, name: 'Renamed' }
    mockResponse(updated)
    const store = useLedgersStore()
    store.ledgers = [ledger]
    store.activeLedger = ledger
    const result = await store.update('1', { name: 'Renamed' })
    expect(result.name).toBe('Renamed')
    expect(store.ledgers[0].name).toBe('Renamed')
    expect(store.activeLedger?.name).toBe('Renamed')
  })

  it('update does not touch activeLedger when id differs', async () => {
    const other = { ...ledger, id: '2', name: 'Other' }
    mockResponse({ ...other, name: 'Other renamed' })
    const store = useLedgersStore()
    store.ledgers = [ledger, other]
    store.activeLedger = ledger
    await store.update('2', { name: 'Other renamed' })
    expect(store.activeLedger?.name).toBe('Familia')
  })

  it('fetchInvite returns invite detail', async () => {
    const detail = { token: 'tok', role: 'editor', ledger_id: '1', ledger_name: 'Familia', invited_by: 'Alice' }
    mockResponse(detail)
    const store = useLedgersStore()
    const result = await store.fetchInvite('tok')
    expect(result.ledger_name).toBe('Familia')
    expect(result.invited_by).toBe('Alice')
  })

  it('acceptInvite posts to accept endpoint', async () => {
    mockResponse({ detail: 'Joined ledger.' })
    const store = useLedgersStore()
    const result = await store.acceptInvite('tok')
    expect(result.detail).toBe('Joined ledger.')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/invites/tok/accept/'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
