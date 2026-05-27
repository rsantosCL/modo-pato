<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '@/lib/api'
import {
  validateCatalogItem,
  validateRevision,
  hasErrors,
  type CatalogItemForm,
  type RevisionForm,
  type ItemCategory,
  type ItemFrequency,
  type CurrencyType,
  type PaymentSource,
} from '@/lib/validation'

const { t, n } = useI18n()
const route = useRoute()
const ledgerId = route.params.id as string

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogItemRevision {
  id: string
  effective_from_month: string
  amount_real: string
  payment_source: PaymentSource
  note: string
  created_at: string
  created_by_id: string
}

interface CatalogItem {
  id: string
  ledger_id: string
  category: ItemCategory
  name: string
  currency: CurrencyType
  frequency: ItemFrequency
  custom_months: number[] | null
  start_month: string
  total_installments: number | null
  payoff_month: string | null
  is_saving: boolean
  revisions: CatalogItemRevision[]
  valid_months: number[]
  end_month: string | null
  prepaid_installments: number
}

// ── State ─────────────────────────────────────────────────────────────────────

const loading = ref(true)
const items = ref<CatalogItem[]>([])

const CATEGORIES: ItemCategory[] = ['income', 'essential', 'variable', 'provision']

const itemsByCategory = computed(() =>
  Object.fromEntries(
    CATEGORIES.map(cat => [cat, items.value.filter(i => i.category === cat)])
  ) as Record<ItemCategory, CatalogItem[]>
)

// ── Create item dialog ────────────────────────────────────────────────────────

const createDialog = ref<HTMLDialogElement | null>(null)
const createErrors = ref<Record<string, string>>({})
const createSubmitting = ref(false)

const createForm = ref<CatalogItemForm>({
  name: '',
  category: 'variable',
  currency: 'CLP',
  frequency: 'M',
  custom_months: null,
  start_month: '',
  total_installments: null,
  payoff_month: null,
  is_saving: false,
})

const createRevisionForm = ref<RevisionForm>({
  effective_from_month: '',
  amount_real: '',
  payment_source: 'CASH',
  note: '',
})

function openCreateDialog() {
  createForm.value = {
    name: '', category: 'variable', currency: 'CLP', frequency: 'M',
    custom_months: null, start_month: '', total_installments: null,
    payoff_month: null, is_saving: false,
  }
  createRevisionForm.value = { effective_from_month: '', amount_real: '', payment_source: 'CASH', note: '' }
  createErrors.value = {}
  createDialog.value?.showModal()
}

function toApiMonth(ym: string): string {
  return ym ? `${ym}-01` : ''
}

function fromApiMonth(ymd: string): string {
  return ymd ? ymd.slice(0, 7) : ''
}

async function submitCreate() {
  const itemErrors = validateCatalogItem(createForm.value)
  const revErrors = validateRevision(
    { ...createRevisionForm.value, effective_from_month: createForm.value.start_month },
    createForm.value.start_month,
  )
  createErrors.value = { ...itemErrors, ...Object.fromEntries(Object.entries(revErrors).map(([k, v]) => [`revision_${k}`, v])) }
  if (hasErrors(createErrors.value)) return

  createSubmitting.value = true
  try {
    const apiStartMonth = toApiMonth(createForm.value.start_month)
    const payload = {
      ...createForm.value,
      start_month: apiStartMonth,
      payoff_month: createForm.value.payoff_month ? toApiMonth(createForm.value.payoff_month) : null,
      first_revision: {
        ...createRevisionForm.value,
        effective_from_month: apiStartMonth,
      },
    }
    const created = await api.post<CatalogItem>(`v1/ledgers/${ledgerId}/catalog-items/`, payload)
    items.value.push(created)
    createDialog.value?.close()
  } catch {
    createErrors.value.form = t('common.error')
  } finally {
    createSubmitting.value = false
  }
}

// ── Revisions dialog ──────────────────────────────────────────────────────────

const revisionsDialog = ref<HTMLDialogElement | null>(null)
const activeItem = ref<CatalogItem | null>(null)
const revisionForm = ref<RevisionForm>({ effective_from_month: '', amount_real: '', payment_source: 'CASH', note: '' })
const revisionErrors = ref<Record<string, string>>({})
const revisionSubmitting = ref(false)
const showAddRevision = ref(false)

function openRevisionsDialog(item: CatalogItem) {
  activeItem.value = item
  revisionForm.value = { effective_from_month: '', amount_real: '', payment_source: 'CASH', note: '' }
  revisionErrors.value = {}
  showAddRevision.value = false
  revisionsDialog.value?.showModal()
}

async function submitRevision() {
  if (!activeItem.value) return
  revisionErrors.value = validateRevision(revisionForm.value, fromApiMonth(activeItem.value.start_month))
  if (hasErrors(revisionErrors.value)) return

  revisionSubmitting.value = true
  try {
    const created = await api.post<CatalogItemRevision>(
      `v1/catalog-items/${activeItem.value.id}/revisions/`,
      { ...revisionForm.value, effective_from_month: toApiMonth(revisionForm.value.effective_from_month) }
    )
    activeItem.value.revisions.push(created)
    activeItem.value.revisions.sort((a, b) => a.effective_from_month.localeCompare(b.effective_from_month))
    showAddRevision.value = false
  } catch {
    revisionErrors.value.form = t('common.error')
  } finally {
    revisionSubmitting.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeRevision(item: CatalogItem): CatalogItemRevision | null {
  const today = new Date().toISOString().slice(0, 7) + '-01'
  const eligible = item.revisions.filter(r => r.effective_from_month <= today)
  if (!eligible.length) return item.revisions[0] ?? null
  return eligible.reduce((a, b) => a.effective_from_month > b.effective_from_month ? a : b)
}

function formatAmount(amount: string, currency: string): string {
  const num = parseFloat(amount)
  return n(num, { style: 'decimal', maximumFractionDigits: currency === 'CLP' ? 0 : 2 })
}

// ── Load ──────────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    items.value = await api.get<CatalogItem[]>(`v1/ledgers/${ledgerId}/catalog-items/`)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main>
    <section>
      <h2>{{ t('catalog.title') }}</h2>
      <button @click="openCreateDialog">{{ t('catalog.newItem') }}</button>
    </section>

    <div :aria-busy="loading">
      <template v-if="!loading">
        <section v-for="cat in CATEGORIES" :key="cat">
          <h3>{{ t(`catalog.category_${cat}`) }}</h3>

          <p v-if="!itemsByCategory[cat]?.length">{{ t('catalog.noItems') }}</p>
          <figure v-else>
            <table>
              <thead>
                <tr>
                  <th>{{ t('catalog.col.name') }}</th>
                  <th>{{ t('catalog.col.amount') }}</th>
                  <th>{{ t('catalog.col.currency') }}</th>
                  <th>{{ t('catalog.col.frequency') }}</th>
                  <th>{{ t('catalog.col.source') }}</th>
                  <th>{{ t('catalog.col.startMonth') }}</th>
                  <th>{{ t('catalog.col.installments') }}</th>
                  <th>{{ t('catalog.col.endMonth') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in itemsByCategory[cat]" :key="item.id">
                  <td>{{ item.name }}</td>
                  <td>{{ activeRevision(item) ? formatAmount(activeRevision(item)!.amount_real, item.currency) : '—' }}</td>
                  <td>{{ item.currency }}</td>
                  <td>{{ t(`catalog.frequency_${item.frequency}`) }}</td>
                  <td>{{ activeRevision(item) ? t(`catalog.source_${activeRevision(item)!.payment_source}`) : '—' }}</td>
                  <td>{{ item.start_month.slice(0, 7) }}</td>
                  <td>{{ item.total_installments ?? '∞' }}</td>
                  <td>{{ item.end_month ? item.end_month.slice(0, 7) : '∞' }}</td>
                  <td>
                    <button class="secondary" @click="openRevisionsDialog(item)">
                      {{ t('catalog.revisions') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </figure>
        </section>
      </template>
    </div>
  </main>

  <!-- Create item dialog -->
  <dialog ref="createDialog">
    <article>
      <header>
        <button aria-label="Close" rel="prev" @click="createDialog?.close()"></button>
        <h3>{{ t('catalog.newItem') }}</h3>
      </header>

      <form id="create-item-form" @submit.prevent="submitCreate">
        <fieldset class="grid">
          <label>
            {{ t('catalog.col.name') }}
            <input v-model="createForm.name" type="text" required autofocus />
          </label>
          <label>
            {{ t('catalog.col.category') }}
            <select v-model="createForm.category">
              <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ t(`catalog.category_${cat}`) }}</option>
            </select>
          </label>
        </fieldset>

        <fieldset class="grid">
          <label>
            {{ t('catalog.col.currency') }}
            <select v-model="createForm.currency">
              <option value="CLP">CLP</option>
              <option value="CLF">{{ t('catalog.clf_label') }}</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label>
            {{ t('catalog.col.frequency') }}
            <select v-model="createForm.frequency">
              <option value="M">{{ t('catalog.frequency_M') }}</option>
              <option value="Q">{{ t('catalog.frequency_Q') }}</option>
              <option value="H">{{ t('catalog.frequency_H') }}</option>
              <option value="Y">{{ t('catalog.frequency_Y') }}</option>
              <option value="CUSTOM">{{ t('catalog.frequency_CUSTOM') }}</option>
            </select>
          </label>
        </fieldset>

        <fieldset class="grid">
          <label>
            {{ t('catalog.col.startMonth') }}
            <input v-model="createForm.start_month" type="month" required />
            <small v-if="createErrors.start_month" aria-invalid="true">{{ createErrors.start_month }}</small>
          </label>
          <label>
            {{ t('catalog.col.installments') }}
            <input v-model.number="createForm.total_installments" type="number" min="1" :placeholder="t('catalog.infinite')" />
            <small v-if="createErrors.total_installments" aria-invalid="true">{{ createErrors.total_installments }}</small>
          </label>
        </fieldset>

        <fieldset class="grid">
          <label>
            {{ t('catalog.col.amount') }}
            <input v-model="createRevisionForm.amount_real" type="number" step="any" required />
            <small v-if="createErrors.revision_amount_real" aria-invalid="true">{{ createErrors.revision_amount_real }}</small>
          </label>
          <label>
            {{ t('catalog.col.source') }}
            <select v-model="createRevisionForm.payment_source">
              <option value="CASH">{{ t('catalog.source_CASH') }}</option>
              <option value="CREDIT_CARD">{{ t('catalog.source_CREDIT_CARD') }}</option>
            </select>
          </label>
        </fieldset>

        <label v-if="createForm.category === 'provision'">
          <input v-model="createForm.is_saving" type="checkbox" role="switch" />
          {{ t('catalog.isSaving') }}
        </label>

        <p v-if="createErrors.form" aria-live="polite">{{ createErrors.form }}</p>
      </form>

      <footer>
        <button type="button" class="secondary" @click="createDialog?.close()">{{ t('common.cancel') }}</button>
        <button type="submit" form="create-item-form" :aria-busy="createSubmitting">{{ t('common.save') }}</button>
      </footer>
    </article>
  </dialog>

  <!-- Revisions dialog -->
  <dialog ref="revisionsDialog">
    <article>
      <header>
        <button aria-label="Close" rel="prev" @click="revisionsDialog?.close()"></button>
        <h3>{{ activeItem?.name }} — {{ t('catalog.revisions') }}</h3>
      </header>

      <table v-if="activeItem?.revisions.length">
        <thead>
          <tr>
            <th>{{ t('catalog.effectiveFrom') }}</th>
            <th>{{ t('catalog.col.amount') }}</th>
            <th>{{ t('catalog.col.source') }}</th>
            <th>{{ t('catalog.col.note') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rev in activeItem?.revisions" :key="rev.id">
            <td>{{ rev.effective_from_month.slice(0, 7) }}</td>
            <td>{{ activeItem ? formatAmount(rev.amount_real, activeItem.currency) : rev.amount_real }}</td>
            <td>{{ t(`catalog.source_${rev.payment_source}`) }}</td>
            <td>{{ rev.note || '—' }}</td>
          </tr>
        </tbody>
      </table>

      <template v-if="showAddRevision">
        <hr />
        <form id="add-revision-form" @submit.prevent="submitRevision">
          <fieldset class="grid">
            <label>
              {{ t('catalog.effectiveFrom') }}
              <input v-model="revisionForm.effective_from_month" type="month" required autofocus />
              <small v-if="revisionErrors.effective_from_month" aria-invalid="true">{{ revisionErrors.effective_from_month }}</small>
            </label>
            <label>
              {{ t('catalog.col.amount') }}
              <input v-model="revisionForm.amount_real" type="number" step="any" required />
              <small v-if="revisionErrors.amount_real" aria-invalid="true">{{ revisionErrors.amount_real }}</small>
            </label>
          </fieldset>
          <fieldset class="grid">
            <label>
              {{ t('catalog.col.source') }}
              <select v-model="revisionForm.payment_source">
                <option value="CASH">{{ t('catalog.source_CASH') }}</option>
                <option value="CREDIT_CARD">{{ t('catalog.source_CREDIT_CARD') }}</option>
              </select>
            </label>
            <label>
              {{ t('catalog.col.note') }}
              <input v-model="revisionForm.note" type="text" />
            </label>
          </fieldset>
          <p v-if="revisionErrors.form" aria-live="polite">{{ revisionErrors.form }}</p>
        </form>
      </template>

      <footer>
        <button v-if="!showAddRevision" type="button" class="secondary" @click="revisionsDialog?.close()">{{ t('common.cancel') }}</button>
        <button v-if="!showAddRevision" type="button" @click="showAddRevision = true">{{ t('catalog.addRevision') }}</button>
        <template v-else>
          <button type="button" class="secondary" @click="showAddRevision = false">{{ t('common.cancel') }}</button>
          <button type="submit" form="add-revision-form" :aria-busy="revisionSubmitting">{{ t('common.save') }}</button>
        </template>
      </footer>
    </article>
  </dialog>
</template>
