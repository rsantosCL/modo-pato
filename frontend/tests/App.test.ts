import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import App from '../src/App.vue'

describe('App', () => {
  it('renders root element', () => {
    const wrapper = mount(App)
    expect(wrapper.find('main').exists()).toBe(true)
  })
})
