import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../../src/i18n/locales/en.json'
import LedgerMembersView from '../../../src/views/ledgers/LedgerMembersView.vue'
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

describe('LedgerMembersView', () => {
  beforeEach(() => { setActivePinia(createPinia()); mockFetch.mockReset() })

  it('fetches and renders members on mount', async () => {
    await router.push('/ledgers/1')
    mockResponse([{ user_id: '1', email: 'a@a.com', display_name: 'Alice', role: 'owner', invited_at: '', joined_at: '' }])
    const wrapper = mount(LedgerMembersView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain('Alice')
  })

  it('creates invite and shows token', async () => {
    await router.push('/ledgers/1')
    mockResponse([])
    const wrapper = mount(LedgerMembersView, { global: { plugins: plugins() } })
    await flushPromises()
    mockResponse({ id: '1', token: 'abc123', role: 'editor', created_at: '' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('abc123')
  })

  it('shows error when invite fails', async () => {
    await router.push('/ledgers/1')
    mockResponse([])
    const wrapper = mount(LedgerMembersView, { global: { plugins: plugins() } })
    await flushPromises()
    const store = useLedgersStore()
    vi.spyOn(store, 'createInvite').mockRejectedValueOnce(new Error('fail'))
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })
})
