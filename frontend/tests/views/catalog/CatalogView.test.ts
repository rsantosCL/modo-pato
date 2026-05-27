import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../../src/i18n/locales/en.json'
import CatalogView from '../../../src/views/catalog/CatalogView.vue'

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
  routes: [{ path: '/ledgers/:id/catalog', component: CatalogView }],
})

function plugins() {
  return [i18n, router, createPinia()]
}

const COMBUSTIBLE = {
  id: 'item-1', ledger_id: 'ledger-1', category: 'variable', name: 'Combustible',
  currency: 'CLP', frequency: 'M', custom_months: null, start_month: '2025-01-01',
  total_installments: null, payoff_month: null, is_saving: false,
  revisions: [
    { id: 'rev-1', effective_from_month: '2025-01-01', amount_real: '100000.0000', payment_source: 'CREDIT_CARD', note: '', created_at: '', created_by_id: 'u1' },
  ],
  valid_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  end_month: null,
  prepaid_installments: 0,
}

describe('CatalogView', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    mockFetch.mockReset()
    HTMLDialogElement.prototype.showModal = vi.fn()
    HTMLDialogElement.prototype.close = vi.fn()
    await router.push('/ledgers/ledger-1/catalog')
  })

  // ── Initial render ──────────────────────────────────────────────────────────

  it('renders all four category sections', async () => {
    mockResponse([])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain(en.catalog.category_income)
    expect(wrapper.text()).toContain(en.catalog.category_essential)
    expect(wrapper.text()).toContain(en.catalog.category_variable)
    expect(wrapper.text()).toContain(en.catalog.category_provision)
  })

  it('shows empty state when no items', async () => {
    mockResponse([])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain(en.catalog.noItems)
  })

  it('renders a fetched item in the correct category row', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain('Combustible')
  })

  // ── Create item ─────────────────────────────────────────────────────────────

  it('opens create dialog on "New item" click', async () => {
    mockResponse([])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('shows validation errors and keeps dialog open when submitting empty form', async () => {
    mockResponse([])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    await wrapper.find('#create-item-form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(true)
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled()
  })

  it('submits create form, calls API, and adds item to the list', async () => {
    mockResponse([]) // initial load
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    await wrapper.find('button').trigger('click') // open dialog
    await wrapper.find('input[type="text"]').setValue('Combustible')
    await wrapper.find('input[type="month"]').setValue('2025-01')
    await wrapper.find('input[step="any"]').setValue('100000')

    mockResponse(COMBUSTIBLE, 201)
    await wrapper.find('#create-item-form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Combustible')
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  // ── Income category ─────────────────────────────────────────────────────────

  it('hides payment source dropdown when income category is selected', async () => {
    mockResponse([])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    const categorySelect = wrapper.findAll('select').find(s =>
      s.findAll('option').some(o => o.element.value === 'income')
    )
    await categorySelect!.setValue('income')
    await wrapper.vm.$nextTick()
    const sourceSelect = wrapper.findAll('select').find(s =>
      s.findAll('option').some(o => o.element.value === 'CREDIT_CARD')
    )
    expect(sourceSelect).toBeUndefined()
  })

  // ── Revisions dialog ────────────────────────────────────────────────────────

  it('opens revisions dialog showing the item revision history', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const revBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.revisions)
    await revBtn!.trigger('click')

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect(wrapper.text()).toContain('2025-01') // effective_from_month
  })

  it('adds a new revision via the revisions dialog', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const revBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.revisions)
    await revBtn!.trigger('click')

    const addBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.addRevision)
    await addBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const addForm = wrapper.find('#add-revision-form')
    await addForm.find('input[type="month"]').setValue('2026-01')
    await addForm.find('input[step="any"]').setValue('120000')

    const newRev = { id: 'rev-2', effective_from_month: '2026-01-01', amount_real: '120000.0000', payment_source: 'CREDIT_CARD', note: '', created_at: '', created_by_id: 'u1' }
    mockResponse(newRev, 201)
    await addForm.trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('2026-01')
  })
})
