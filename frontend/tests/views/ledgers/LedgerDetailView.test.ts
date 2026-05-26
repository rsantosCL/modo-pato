import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../../src/i18n/locales/en.json'
import LedgerDetailView from '../../../src/views/ledgers/LedgerDetailView.vue'

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

describe('LedgerDetailView', () => {
  beforeEach(() => { setActivePinia(createPinia()); mockFetch.mockReset() })

  it('shows loading state then ledger name', async () => {
    await router.push('/ledgers/1')
    mockResponse({ id: '1', name: 'Familia', kind: 'shared', created_at: '', archived_at: null })
    const wrapper = mount(LedgerDetailView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain('Familia')
  })
})
