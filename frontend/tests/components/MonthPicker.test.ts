import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '../../src/i18n/locales/en.json'
import MonthPicker from '../../src/components/MonthPicker.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function mountPicker(modelValue = '') {
  return mount(MonthPicker, {
    props: { modelValue },
    global: { plugins: [i18n] },
  })
}

describe('MonthPicker', () => {
  it('"Current month" link emits the current YYYY-MM', async () => {
    const wrapper = mountPicker()
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    await wrapper.findAll('a').find(a => a.text() === en.common.currentMonth)!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([expected])
  })

  it('"Clear" link emits empty string and resets selects', async () => {
    const wrapper = mountPicker('2025-03')

    await wrapper.findAll('a').find(a => a.text() === en.common.clear)!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
    const [yearSelect, monthSelect] = wrapper.findAll('select')
    expect((yearSelect.element as HTMLSelectElement).value).toBe('')
    expect((monthSelect.element as HTMLSelectElement).value).toBe('')
  })
})
