import { describe, it, expect } from 'vitest'
import {
  validMonths,
  endMonth,
  validateCatalogItem,
  validateRevision,
  hasErrors,
  type CatalogItemForm,
  type RevisionForm,
} from '../../src/lib/validation'

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseItem(overrides: Partial<CatalogItemForm> = {}): CatalogItemForm {
  return {
    name: 'Test',
    category: 'variable',
    currency: 'CLP',
    frequency: 'M',
    custom_months: null,
    start_month: '2025-01',
    total_installments: null,
    payoff_month: null,
    is_saving: false,
    ...overrides,
  }
}

function baseRevision(overrides: Partial<RevisionForm> = {}): RevisionForm {
  return {
    effective_from_month: '2025-01',
    amount_real: '100000',
    payment_source: 'CASH',
    ...overrides,
  }
}

// ── validMonths ───────────────────────────────────────────────────────────────

describe('validMonths', () => {
  it('M returns all 12 months', () => {
    expect(validMonths('M', '2025-01', null)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('Q from March returns [3, 6, 9, 12]', () => {
    expect(validMonths('Q', '2025-03', null)).toEqual([3, 6, 9, 12])
  })

  it('Q wraps correctly (e.g. November → [2, 5, 8, 11])', () => {
    expect(validMonths('Q', '2025-11', null)).toEqual([2, 5, 8, 11])
  })

  it('H from March returns [3, 9]', () => {
    expect(validMonths('H', '2025-03', null)).toEqual([3, 9])
  })

  it('Y returns only the start month', () => {
    expect(validMonths('Y', '2025-07', null)).toEqual([7])
  })

  it('CUSTOM returns sorted custom_months', () => {
    expect(validMonths('CUSTOM', '2025-01', [10, 1, 4, 7])).toEqual([1, 4, 7, 10])
  })

  it('CUSTOM with null falls back to empty array', () => {
    expect(validMonths('CUSTOM', '2025-01', null)).toEqual([])
  })
})

// ── endMonth ─────────────────────────────────────────────────────────────────

describe('endMonth', () => {
  it('returns null for infinite (null installments)', () => {
    expect(endMonth('2025-03', 'M', null, null)).toBeNull()
  })

  it('24 monthly installments from 2025-03 → 2027-02 (Appendix B Salary)', () => {
    expect(endMonth('2025-03', 'M', null, 24)).toBe('2027-02')
  })

  it('3 yearly installments from 2025-03 → 2027-03', () => {
    expect(endMonth('2025-03', 'Y', null, 3)).toBe('2027-03')
  })

  it('4 quarterly installments from 2025-03 → 2025-12', () => {
    expect(endMonth('2025-03', 'Q', null, 4)).toBe('2025-12')
  })

  it('1 installment returns start month', () => {
    expect(endMonth('2025-06', 'Y', null, 1)).toBe('2025-06')
  })
})

// ── validateCatalogItem ───────────────────────────────────────────────────────

describe('validateCatalogItem — start_month', () => {
  it('empty start_month is an error', () => {
    expect(validateCatalogItem(baseItem({ start_month: '' })).start_month).toBeTruthy()
  })

  it('invalid format (YYYY-MM-DD) is an error', () => {
    expect(validateCatalogItem(baseItem({ start_month: '2025-01-01' })).start_month).toBeTruthy()
  })

  it('valid YYYY-MM is accepted', () => {
    expect(validateCatalogItem(baseItem({ start_month: '2025-01' })).start_month).toBeUndefined()
  })
})

describe('validateCatalogItem — total_installments', () => {
  it('zero is an error', () => {
    expect(validateCatalogItem(baseItem({ total_installments: 0 })).total_installments).toBeTruthy()
  })

  it('negative is an error', () => {
    expect(validateCatalogItem(baseItem({ total_installments: -1 })).total_installments).toBeTruthy()
  })

  it('non-integer is an error', () => {
    expect(validateCatalogItem(baseItem({ total_installments: 1.5 })).total_installments).toBeTruthy()
  })

  it('null is accepted (infinite)', () => {
    expect(validateCatalogItem(baseItem({ total_installments: null })).total_installments).toBeUndefined()
  })

  it('positive integer is accepted', () => {
    expect(validateCatalogItem(baseItem({ total_installments: 12 })).total_installments).toBeUndefined()
  })
})

describe('validateCatalogItem — frequency / custom_months', () => {
  it('CUSTOM without custom_months is an error', () => {
    expect(validateCatalogItem(baseItem({ frequency: 'CUSTOM', custom_months: null })).custom_months).toBeTruthy()
  })

  it('CUSTOM with out-of-range value is an error', () => {
    expect(validateCatalogItem(baseItem({ frequency: 'CUSTOM', custom_months: [0, 3, 6] })).custom_months).toBeTruthy()
  })

  it('CUSTOM with valid months is accepted', () => {
    expect(validateCatalogItem(baseItem({ frequency: 'CUSTOM', custom_months: [1, 4, 7, 10] })).custom_months).toBeUndefined()
  })

  it('non-CUSTOM with custom_months set is an error', () => {
    expect(validateCatalogItem(baseItem({ frequency: 'M', custom_months: [1, 2, 3] })).custom_months).toBeTruthy()
  })

  it('non-CUSTOM without custom_months is accepted', () => {
    expect(validateCatalogItem(baseItem({ frequency: 'M', custom_months: null })).custom_months).toBeUndefined()
  })
})

describe('validateCatalogItem — income has no payoff_month', () => {
  it('rejects payoff_month on income items', () => {
    expect(validateCatalogItem(baseItem({ category: 'income', payoff_month: '2025-06' })).payoff_month).toBeTruthy()
  })

  it('accepts payoff_month on non-income items', () => {
    const errors = validateCatalogItem(baseItem({
      category: 'essential', frequency: 'M', start_month: '2025-01', payoff_month: '2025-06',
    }))
    expect(errors.payoff_month).toBeUndefined()
  })
})

describe('validateCatalogItem — payoff_month', () => {
  it('invalid format is an error', () => {
    expect(validateCatalogItem(baseItem({ payoff_month: '2025-01-01' })).payoff_month).toBeTruthy()
  })

  it('before start_month is an error', () => {
    const errors = validateCatalogItem(baseItem({ start_month: '2025-03', payoff_month: '2025-01' }))
    expect(errors.payoff_month).toBeTruthy()
  })

  it('not on a valid month for the frequency is an error', () => {
    // Yearly starting March; April is not valid
    const errors = validateCatalogItem(baseItem({ frequency: 'Y', start_month: '2025-03', payoff_month: '2026-04' }))
    expect(errors.payoff_month).toBeTruthy()
  })

  it('after end_month is an error', () => {
    // 3 yearly installments: end = 2027-03; payoff at 2028-03 is too late
    const errors = validateCatalogItem(baseItem({
      frequency: 'Y', start_month: '2025-03', total_installments: 3, payoff_month: '2028-03',
    }))
    expect(errors.payoff_month).toBeTruthy()
  })

  it('valid payoff_month on a valid month within range is accepted', () => {
    // Yearly starting March; payoff at 2026-03 ≤ end 2027-03
    const errors = validateCatalogItem(baseItem({
      frequency: 'Y', start_month: '2025-03', total_installments: 3, payoff_month: '2026-03',
    }))
    expect(errors.payoff_month).toBeUndefined()
  })

  it('null payoff_month produces no error', () => {
    expect(validateCatalogItem(baseItem({ payoff_month: null })).payoff_month).toBeUndefined()
  })
})

// ── validateRevision ──────────────────────────────────────────────────────────

describe('validateRevision — effective_from_month', () => {
  it('empty effective_from_month is an error', () => {
    expect(validateRevision(baseRevision({ effective_from_month: '' }), '2025-01', 'variable').effective_from_month).toBeTruthy()
  })

  it('invalid format (YYYY-MM-DD) is an error', () => {
    expect(validateRevision(baseRevision({ effective_from_month: '2025-01-01' }), '2025-01', 'variable').effective_from_month).toBeTruthy()
  })

  it('after start_month is an error for the first revision', () => {
    const errors = validateRevision(baseRevision({ effective_from_month: '2025-03' }), '2025-01', 'variable', true)
    expect(errors.effective_from_month).toBeTruthy()
  })

  it('after start_month is accepted for subsequent revisions', () => {
    const errors = validateRevision(baseRevision({ effective_from_month: '2026-01' }), '2025-01', 'variable', false)
    expect(errors.effective_from_month).toBeUndefined()
  })

  it('at or before start_month is accepted', () => {
    expect(validateRevision(baseRevision({ effective_from_month: '2024-06' }), '2025-01', 'variable', true).effective_from_month).toBeUndefined()
  })
})

describe('validateRevision — amount_real', () => {
  it('empty amount is an error', () => {
    expect(validateRevision(baseRevision({ amount_real: '' }), '2025-01', 'variable').amount_real).toBeTruthy()
  })

  it('non-numeric amount is an error', () => {
    expect(validateRevision(baseRevision({ amount_real: 'abc' }), '2025-01', 'variable').amount_real).toBeTruthy()
  })

  it('valid numeric amount is accepted', () => {
    expect(validateRevision(baseRevision({ amount_real: '100000' }), '2025-01', 'variable').amount_real).toBeUndefined()
  })
})

describe('validateRevision — income payment source', () => {
  it('rejects CREDIT_CARD for income items', () => {
    expect(validateRevision(baseRevision({ payment_source: 'CREDIT_CARD' }), '2025-01', 'income').payment_source).toBeTruthy()
  })

  it('accepts CASH for income items', () => {
    expect(validateRevision(baseRevision({ payment_source: 'CASH' }), '2025-01', 'income').payment_source).toBeUndefined()
  })

  it('allows CREDIT_CARD for non-income items', () => {
    expect(validateRevision(baseRevision({ payment_source: 'CREDIT_CARD' }), '2025-01', 'variable').payment_source).toBeUndefined()
  })
})

// ── hasErrors ─────────────────────────────────────────────────────────────────

describe('hasErrors', () => {
  it('returns false for empty errors', () => {
    expect(hasErrors({})).toBe(false)
  })

  it('returns true when any error is present', () => {
    expect(hasErrors({ start_month: 'Required.' })).toBe(true)
  })
})
