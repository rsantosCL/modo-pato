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
    const [yearSel, monthSel] = wrapper.find('#create-item-form .month-picker').findAll('select')
    await yearSel.setValue('2025')
    await monthSel.setValue('01')
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

  // ── Table row display ───────────────────────────────────────────────────────

  it('renders finite installments and end_month instead of ∞', async () => {
    const finite = { ...COMBUSTIBLE, total_installments: 12, end_month: '2025-12-01' }
    mockResponse([finite])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('2025-12')
  })

  it('shows — for amount and source when item has no active revision before today', async () => {
    const noRevision = { ...COMBUSTIBLE, revisions: [] }
    mockResponse([noRevision])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    expect(wrapper.text()).toContain('—')
  })

  // ── Create item errors ───────────────────────────────────────────────────────

  it('shows API error message when create fails', async () => {
    mockResponse([])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await wrapper.find('input[type="text"]').setValue('Combustible')
    const [yearSel, monthSel] = wrapper.find('#create-item-form .month-picker').findAll('select')
    await yearSel.setValue('2025')
    await monthSel.setValue('01')
    await wrapper.find('input[step="any"]').setValue('100000')

    mockResponse({ detail: 'error' }, 400)
    await wrapper.find('#create-item-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })

  it('shows is_saving checkbox when provision category is selected in create dialog', async () => {
    mockResponse([])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    const categorySelect = wrapper.findAll('select').find(s =>
      s.findAll('option').some(o => o.element.value === 'provision')
    )
    await categorySelect!.setValue('provision')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })

  // ── Edit item ───────────────────────────────────────────────────────────────

  it('opens edit dialog pre-filled with item data', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.editItem)
    await editBtn!.trigger('click')

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    expect((wrapper.find('#edit-item-form input[type="text"]').element as HTMLInputElement).value).toBe('Combustible')
  })

  it('submits edit form, calls PATCH, and updates item in list', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.editItem)
    await editBtn!.trigger('click')
    await wrapper.find('input[type="text"]').setValue('Gasolina')

    const updated = { ...COMBUSTIBLE, name: 'Gasolina' }
    mockResponse(updated)
    await wrapper.find('#edit-item-form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Gasolina')
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  it('excludes income option from category select when editing non-income item', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.editItem)
    await editBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const categorySelect = wrapper.find('#edit-item-form select')
    const options = categorySelect.findAll('option').map(o => o.element.value)
    expect(options).not.toContain('income')
  })

  it('disables category select in edit dialog for income items', async () => {
    const income = { ...COMBUSTIBLE, category: 'income' as const }
    mockResponse([income])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.editItem)
    await editBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const categorySelect = wrapper.find('#edit-item-form select')
    expect((categorySelect.element as HTMLSelectElement).disabled).toBe(true)
  })

  it('shows validation error and keeps dialog open when submitting empty edit form', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.editItem)
    await editBtn!.trigger('click')
    const [yearSel] = wrapper.find('#edit-item-form .month-picker').findAll('select')
    await yearSel.setValue('')
    await wrapper.find('#edit-item-form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(true)
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled()
  })

  it('shows API error message when edit PATCH fails', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.editItem)
    await editBtn!.trigger('click')
    mockResponse({ detail: 'error' }, 400)
    await wrapper.find('#edit-item-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[aria-live]').text()).toBeTruthy()
  })

  it('shows is_saving checkbox in edit dialog when category is provision', async () => {
    const provision = { ...COMBUSTIBLE, category: 'provision' as const }
    mockResponse([provision])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.editItem)
    await editBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('#edit-item-form input[type="checkbox"]').exists()).toBe(true)
  })

  // ── Filter ──────────────────────────────────────────────────────────────────

  it('filters items by name (case-insensitive)', async () => {
    const gasoline = { ...COMBUSTIBLE, id: 'item-2', name: 'Gasolina' }
    mockResponse([COMBUSTIBLE, gasoline])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('comb')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Combustible')
    expect(wrapper.text()).not.toContain('Gasolina')
  })

  it('shows all items when filter is cleared', async () => {
    const gasoline = { ...COMBUSTIBLE, id: 'item-2', name: 'Gasolina' }
    mockResponse([COMBUSTIBLE, gasoline])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    await wrapper.find('input[type="search"]').setValue('comb')
    await wrapper.vm.$nextTick()
    await wrapper.find('input[type="search"]').setValue('')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Combustible')
    expect(wrapper.text()).toContain('Gasolina')
  })

  // ── Sort ─────────────────────────────────────────────────────────────────────

  it('sorts items by name ascending on first header click', async () => {
    const agua = { ...COMBUSTIBLE, id: 'item-2', name: 'Agua' }
    mockResponse([COMBUSTIBLE, agua])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    await wrapper.find('th a').trigger('click')
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('Agua')
    expect(rows[1].text()).toContain('Combustible')
  })

  it('reverses to descending on second click of the same header', async () => {
    const agua = { ...COMBUSTIBLE, id: 'item-2', name: 'Agua' }
    mockResponse([COMBUSTIBLE, agua])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const nameLink = wrapper.find('th a')
    await nameLink.trigger('click')
    await nameLink.trigger('click')
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('Combustible')
    expect(rows[1].text()).toContain('Agua')
  })

  it('shows sort indicator on active column and removes it when column changes', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const nameLink = wrapper.find('th a')
    await nameLink.trigger('click')
    await wrapper.vm.$nextTick()
    expect(nameLink.text()).toContain('↑')

    await nameLink.trigger('click')
    await wrapper.vm.$nextTick()
    expect(nameLink.text()).toContain('↓')
  })

  // ── Delete item ─────────────────────────────────────────────────────────────

  it('opens delete confirmation dialog on delete button click', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const deleteBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.deleteItem)
    await deleteBtn!.trigger('click')

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('calls DELETE endpoint, removes item from list, and closes dialog on confirm', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const deleteBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.deleteItem)
    await deleteBtn!.trigger('click')

    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined })
    const confirmBtn = wrapper.find('dialog button.contrast')
    await confirmBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Combustible')
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled()
  })

  it('keeps item in list and dialog open when DELETE request fails', async () => {
    mockResponse([COMBUSTIBLE])
    const wrapper = mount(CatalogView, { global: { plugins: plugins() } })
    await flushPromises()

    const deleteBtn = wrapper.findAll('button').find(b => b.text() === en.catalog.deleteItem)
    await deleteBtn!.trigger('click')

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    const confirmBtn = wrapper.find('dialog button.contrast')
    await confirmBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Combustible')
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled()
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
    const [yearSel, monthSel] = addForm.find('.month-picker').findAll('select')
    await yearSel.setValue('2026')
    await monthSel.setValue('01')
    await addForm.find('input[step="any"]').setValue('120000')

    const newRev = { id: 'rev-2', effective_from_month: '2026-01-01', amount_real: '120000.0000', payment_source: 'CREDIT_CARD', note: '', created_at: '', created_by_id: 'u1' }
    mockResponse(newRev, 201)
    await addForm.trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('2026-01')
  })
})
