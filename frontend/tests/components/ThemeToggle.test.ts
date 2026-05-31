import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import en from '../../src/i18n/locales/en.json'
import ThemeToggle from '../../src/components/ThemeToggle.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function mountToggle() {
  return mount(ThemeToggle, { global: { plugins: [i18n] } })
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders three links', () => {
    const wrapper = mountToggle()
    expect(wrapper.findAll('a')).toHaveLength(3)
  })

  it('auto is current by default', () => {
    const wrapper = mountToggle()
    const links = wrapper.findAll('a')
    expect(links[0].attributes('aria-current')).toBe('true')
    expect(links[1].attributes('aria-current')).toBeUndefined()
    expect(links[2].attributes('aria-current')).toBeUndefined()
  })

  it('clicking light sets data-theme="light" and marks it current', async () => {
    const wrapper = mountToggle()
    await wrapper.findAll('a')[1].trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(wrapper.findAll('a')[1].attributes('aria-current')).toBe('true')
  })

  it('clicking dark sets data-theme="dark"', async () => {
    const wrapper = mountToggle()
    await wrapper.findAll('a')[2].trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('clicking auto removes data-theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const wrapper = mountToggle()
    await wrapper.findAll('a')[2].trigger('click')
    await wrapper.findAll('a')[0].trigger('click')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('persists selection to localStorage', async () => {
    const wrapper = mountToggle()
    await wrapper.findAll('a')[2].trigger('click')
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})
