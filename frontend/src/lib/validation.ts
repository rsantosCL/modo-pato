/**
 * Client-side catalog validation (§13.3). Backend remains authoritative.
 * All year-month values are YYYY-MM strings; conversion to YYYY-MM-01 happens at API boundary.
 */

export type ItemFrequency = 'M' | 'Q' | 'H' | 'Y' | 'CUSTOM'
export type ItemCategory = 'income' | 'essential' | 'variable' | 'provision'
export type CurrencyType = 'CLP' | 'CLF' | 'USD'
export type PaymentSource = 'CASH' | 'CREDIT_CARD'

export interface CatalogItemForm {
  name: string
  category: ItemCategory
  currency: CurrencyType
  frequency: ItemFrequency
  custom_months: number[] | null
  start_month: string        // YYYY-MM
  total_installments: number | null
  payoff_month: string | null  // YYYY-MM
  is_saving: boolean
}

export interface RevisionForm {
  effective_from_month: string  // YYYY-MM
  amount_real: string
  payment_source: PaymentSource
  note?: string
}

export type ValidationErrors = Record<string, string>

// ── Month arithmetic helpers ──────────────────────────────────────────────────

function parseYM(ym: string): { year: number; month: number } {
  const [year, month] = ym.split('-').map(Number)
  return { year, month }
}

function advanceMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

function ymToInt(year: number, month: number): number {
  return year * 12 + month
}

export function validMonths(frequency: ItemFrequency, startMonth: string, customMonths: number[] | null): number[] {
  const { month: m } = parseYM(startMonth)
  switch (frequency) {
    case 'M': return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    case 'Q': return [...new Set([0, 3, 6, 9].map(o => ((m - 1 + o) % 12) + 1))].sort((a, b) => a - b)
    case 'H': return [...new Set([0, 6].map(o => ((m - 1 + o) % 12) + 1))].sort((a, b) => a - b)
    case 'Y': return [m]
    case 'CUSTOM': return [...(customMonths ?? [])].sort((a, b) => a - b)
  }
}

export function endMonth(
  startMonth: string,
  frequency: ItemFrequency,
  customMonths: number[] | null,
  totalInstallments: number | null,
): string | null {
  if (totalInstallments === null) return null
  const vm = validMonths(frequency, startMonth, customMonths)
  let { year, month } = parseYM(startMonth)
  let count = 0
  let last = startMonth
  while (count < totalInstallments) {
    if (vm.includes(month)) {
      count++
      last = `${year}-${String(month).padStart(2, '0')}`
    }
    if (count < totalInstallments) {
      ;({ year, month } = advanceMonth(year, month))
    }
  }
  return last
}

// ── Validation ────────────────────────────────────────────────────────────────

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function isValidYM(v: string | null | undefined): v is string {
  return typeof v === 'string' && YM_RE.test(v)
}

export function validateCatalogItem(form: CatalogItemForm): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!isValidYM(form.start_month)) {
    errors.start_month = 'Required. Use YYYY-MM format.'
  }

  if (form.total_installments !== null && (form.total_installments < 1 || !Number.isInteger(form.total_installments))) {
    errors.total_installments = 'Must be a positive integer or left empty (∞).'
  }

  if (form.frequency === 'CUSTOM') {
    if (!form.custom_months || form.custom_months.length === 0) {
      errors.custom_months = 'Required for custom frequency.'
    } else if (form.custom_months.some(m => m < 1 || m > 12)) {
      errors.custom_months = 'All values must be between 1 and 12.'
    }
  } else if (form.custom_months && form.custom_months.length > 0) {
    errors.custom_months = 'Only allowed for custom frequency.'
  }

  if (form.payoff_month !== null && form.payoff_month !== undefined && form.payoff_month !== '') {
    if (!isValidYM(form.payoff_month)) {
      errors.payoff_month = 'Use YYYY-MM format.'
    } else if (isValidYM(form.start_month)) {
      const startInt = ymToInt(...Object.values(parseYM(form.start_month)) as [number, number])
      const payoffInt = ymToInt(...Object.values(parseYM(form.payoff_month)) as [number, number])

      if (payoffInt < startInt) {
        errors.payoff_month = 'Cannot be before start month.'
      } else {
        const vm = validMonths(form.frequency, form.start_month, form.custom_months)
        const { month: pm } = parseYM(form.payoff_month)
        if (!vm.includes(pm)) {
          errors.payoff_month = 'Must fall on a valid month for this frequency.'
        }

        const end = endMonth(form.start_month, form.frequency, form.custom_months, form.total_installments)
        if (end !== null) {
          const endInt = ymToInt(...Object.values(parseYM(end)) as [number, number])
          if (payoffInt > endInt) {
            errors.payoff_month = 'Cannot be after the last installment month.'
          }
        }
      }
    }
  }

  return errors
}

export function validateRevision(
  form: RevisionForm,
  startMonth: string,
  category: ItemCategory,
  isFirstRevision = false,
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!isValidYM(form.effective_from_month)) {
    errors.effective_from_month = 'Required. Use YYYY-MM format.'
  } else if (isFirstRevision && isValidYM(startMonth)) {
    const revInt = ymToInt(...Object.values(parseYM(form.effective_from_month)) as [number, number])
    const startInt = ymToInt(...Object.values(parseYM(startMonth)) as [number, number])
    if (revInt > startInt) {
      errors.effective_from_month = 'First revision must cover the start month.'
    }
  }

  const amount = parseFloat(form.amount_real)
  if (!form.amount_real || isNaN(amount)) {
    errors.amount_real = 'Required.'
  }

  if (category === 'income' && form.payment_source !== 'CASH') {
    errors.payment_source = 'Income items must use Cash.'
  }

  return errors
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0
}
