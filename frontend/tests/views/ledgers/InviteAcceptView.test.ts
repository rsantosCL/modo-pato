import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../../src/i18n/locales/en.json'
import InviteAcceptView from '../../../src/views/ledgers/InviteAcceptView.vue'
import { useLedgersStore } from '../../../src/stores/ledgers'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/invites/:token', component: InviteAcceptView },
    { path: '/ledgers', component: { template: '<div />' } },
  ],
})

const detail = { token: 'tok', role: 'editor', ledger_id: '1', ledger_name: 'Familia', invited_by: 'Alice' }

let pinia = createPinia()
function plugins() { return [i18n, router, pinia] }

describe('InviteAcceptView', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders invite details on mount', async () => {
    await router.push('/invites/tok')
    const store = useLedgersStore()
    vi.spyOn(store, 'fetchInvite').mockResolvedValueOnce(detail)
    const wrapper = mount(InviteAcceptView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain('Familia')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Editor')
  })

  it('accept calls acceptInvite and redirects to /ledgers', async () => {
    await router.push('/invites/tok')
    const store = useLedgersStore()
    vi.spyOn(store, 'fetchInvite').mockResolvedValueOnce(detail)
    vi.spyOn(store, 'acceptInvite').mockResolvedValueOnce({ detail: 'Joined ledger.' })
    vi.spyOn(store, 'fetchAll').mockResolvedValueOnce()
    const wrapper = mount(InviteAcceptView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(store.acceptInvite).toHaveBeenCalledWith('tok')
    expect(router.currentRoute.value.path).toBe('/ledgers')
  })

  it('shows error when token is invalid', async () => {
    await router.push('/invites/bad')
    const store = useLedgersStore()
    vi.spyOn(store, 'fetchInvite').mockRejectedValueOnce(new Error('not found'))
    const wrapper = mount(InviteAcceptView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })

  it('shows error when accept fails', async () => {
    await router.push('/invites/tok')
    const store = useLedgersStore()
    vi.spyOn(store, 'fetchInvite').mockResolvedValueOnce(detail)
    vi.spyOn(store, 'acceptInvite').mockRejectedValueOnce(new Error('fail'))
    const wrapper = mount(InviteAcceptView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })
})
