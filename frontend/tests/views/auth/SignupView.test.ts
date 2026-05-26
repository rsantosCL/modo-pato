import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../../src/i18n/locales/en.json'
import SignupView from '../../../src/views/auth/SignupView.vue'
import { useAuthStore } from '../../../src/stores/auth'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/login', component: { template: '<div />' } },
    { path: '/ledgers', component: { template: '<div />' } },
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
