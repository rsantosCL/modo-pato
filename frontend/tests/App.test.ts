import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import { useAuthStore } from '../src/stores/auth'

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)', component: { template: '<div />' } }] })
const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { auth: { logout: 'Sign out' }, ledger: { title: 'Ledgers' } } } })

describe('App', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders nav element', () => {
    const wrapper = mount(App, { global: { plugins: [createPinia(), router, i18n] } })
    expect(wrapper.find('nav').exists()).toBe(true)
  })

  it('shows nav links and logout when authenticated', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    ;(auth as any).accessToken = 'tok'
    const wrapper = mount(App, { global: { plugins: [pinia, router, i18n] } })
    expect(wrapper.text()).toContain('Sign out')
    await wrapper.find('a[href="#"]').trigger('click')
    expect(auth.isAuthenticated).toBe(false)
  })
})
