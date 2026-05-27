import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../../src/i18n/locales/en.json'
import LedgerDetailView from '../../../src/views/ledgers/LedgerDetailView.vue'
import { useLedgersStore } from '../../../src/stores/ledgers'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  })
}

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/ledgers', component: { template: '<div />' } },
    { path: '/ledgers/:id', component: { template: '<div />' } },
  ],
})

let pinia = createPinia()
function plugins() { return [i18n, router, pinia] }

const ledger = { id: '1', name: 'Familia', kind: 'shared' as const, created_at: '', archived_at: null }

describe('LedgerDetailView', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    mockFetch.mockReset()
    HTMLDialogElement.prototype.showModal = vi.fn()
    HTMLDialogElement.prototype.close = vi.fn()
  })

  it('shows loading state then ledger name', async () => {
    await router.push('/ledgers/1')
    mockResponse(ledger)
    const wrapper = mount(LedgerDetailView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain('Familia')
  })

  it('edit link opens dialog pre-filled with current values', async () => {
    await router.push('/ledgers/1')
    mockResponse(ledger)
    const wrapper = mount(LedgerDetailView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('a[href="#"]').trigger('click')
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('Familia')
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('shared')
  })

  it('save calls store.update and closes dialog', async () => {
    await router.push('/ledgers/1')
    mockResponse(ledger)
    const wrapper = mount(LedgerDetailView, { global: { plugins: plugins() } })
    await flushPromises()
    const store = useLedgersStore()
    vi.spyOn(store, 'update').mockResolvedValueOnce({ ...ledger, name: 'Renamed' })
    await wrapper.find('a[href="#"]').trigger('click')
    await wrapper.find('input[type="text"]').setValue('Renamed')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(store.update).toHaveBeenCalledWith('1', { name: 'Renamed', kind: 'shared' })
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  it('shows error when save fails', async () => {
    await router.push('/ledgers/1')
    mockResponse(ledger)
    const wrapper = mount(LedgerDetailView, { global: { plugins: plugins() } })
    await flushPromises()
    const store = useLedgersStore()
    vi.spyOn(store, 'update').mockRejectedValueOnce(new Error('fail'))
    await wrapper.find('a[href="#"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })
})
