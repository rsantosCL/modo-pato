import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '../src/views/LoginView.vue'
import { useAuthStore } from '../src/stores/auth'
import en from '../src/i18n/locales/en.json'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/ledgers', component: { template: '<div />' } },
  ],
})

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders email and password inputs', () => {
    const wrapper = mount(LoginView, { global: { plugins: [i18n, router, createPinia()] } })
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('calls auth.login on submit and navigates to /ledgers', async () => {
    const wrapper = mount(LoginView, { global: { plugins: [i18n, router, createPinia()] } })
    const auth = useAuthStore()
    const loginSpy = vi.spyOn(auth, 'login').mockResolvedValueOnce()

    await wrapper.find('input[type="email"]').setValue('alice@example.com')
    await wrapper.find('input[type="password"]').setValue('pass')
    await wrapper.find('form').trigger('submit')

    expect(loginSpy).toHaveBeenCalledWith('alice@example.com', 'pass')
  })

  it('shows error message on failed login', async () => {
    const wrapper = mount(LoginView, { global: { plugins: [i18n, router, createPinia()] } })
    const auth = useAuthStore()
    vi.spyOn(auth, 'login').mockRejectedValueOnce(new Error('fail'))

    await wrapper.find('input[type="email"]').setValue('alice@example.com')
    await wrapper.find('input[type="password"]').setValue('wrong')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })
})
