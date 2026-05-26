import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../../src/i18n/locales/en.json'
import LedgersView from '../../../src/views/ledgers/LedgersView.vue'
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

function plugins() {
  return [i18n, router, createPinia()]
}

describe('LedgersView', () => {
  beforeEach(() => { setActivePinia(createPinia()); mockFetch.mockReset() })

  it('fetches and renders ledgers on mount', async () => {
    mockResponse([{ id: '1', name: 'Familia', kind: 'shared', created_at: '', archived_at: null }])
    const wrapper = mount(LedgersView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain('Familia')
  })

  it('shows empty state when no ledgers', async () => {
    mockResponse([])
    const wrapper = mount(LedgersView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain(en.ledger.noLedgers)
  })

  it('creates a new ledger', async () => {
    mockResponse([])
    const wrapper = mount(LedgersView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    mockResponse({ id: '2', name: 'Personal', kind: 'personal', created_at: '', archived_at: null })
    await wrapper.find('input[type="text"]').setValue('Personal')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(useLedgersStore().ledgers).toHaveLength(1)
  })

  it('cancel hides the create form', async () => {
    mockResponse([])
    const wrapper = mount(LedgersView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)
    await wrapper.find('input[type="reset"]').trigger('click')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('shows error when create fails', async () => {
    mockResponse([])
    const wrapper = mount(LedgersView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    const store = useLedgersStore()
    vi.spyOn(store, 'create').mockRejectedValueOnce(new Error('fail'))
    await wrapper.find('input[type="text"]').setValue('X')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })
})
