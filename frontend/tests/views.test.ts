import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../src/i18n/locales/en.json'
import SignupView from '../src/views/SignupView.vue'
import LedgersView from '../src/views/LedgersView.vue'
import LedgerDetailView from '../src/views/LedgerDetailView.vue'
import LedgerMembersView from '../src/views/LedgerMembersView.vue'
import { useAuthStore } from '../src/stores/auth'
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

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/login', component: { template: '<div />' } },
    { path: '/ledgers', component: { template: '<div />' } },
    { path: '/ledgers/:id', component: { template: '<div />' } },
  ],
})

function plugins() {
  return [i18n, router, createPinia()]
}

describe('SignupView', () => {
  beforeEach(() => { setActivePinia(createPinia()); mockFetch.mockReset() })

  it('renders signup form', () => {
    const wrapper = mount(SignupView, { global: { plugins: plugins() } })
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('calls auth.signup on submit', async () => {
    const wrapper = mount(SignupView, { global: { plugins: plugins() } })
    const auth = useAuthStore()
    const spy = vi.spyOn(auth, 'signup').mockResolvedValueOnce()
    await wrapper.find('input[type="text"]').setValue('Alice')
    await wrapper.find('input[type="email"]').setValue('alice@example.com')
    await wrapper.find('input[type="password"]').setValue('password')
    await wrapper.find('form').trigger('submit')
    expect(spy).toHaveBeenCalled()
  })

  it('shows error on failed signup', async () => {
    const wrapper = mount(SignupView, { global: { plugins: plugins() } })
    const auth = useAuthStore()
    vi.spyOn(auth, 'signup').mockRejectedValueOnce(new Error('fail'))
    await wrapper.find('input[type="text"]').setValue('Alice')
    await wrapper.find('input[type="email"]').setValue('alice@example.com')
    await wrapper.find('input[type="password"]').setValue('password')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })
})

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
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
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
