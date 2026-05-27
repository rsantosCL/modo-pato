import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'

export interface Ledger {
  id: string
  name: string
  kind: 'shared' | 'personal'
  created_at: string
  archived_at: string | null
}

export interface InviteDetail {
  token: string
  role: LedgerMember['role']
  ledger_id: string
  ledger_name: string
  invited_by: string
}

export interface LedgerMember {
  user_id: string
  email: string
  display_name: string
  role: 'owner' | 'editor' | 'viewer'
  invited_at: string
  joined_at: string | null
}

export const useLedgersStore = defineStore('ledgers', () => {
  const ledgers = ref<Ledger[]>([])
  const activeLedger = ref<Ledger | null>(null)

  async function fetchAll() {
    ledgers.value = await api.get<Ledger[]>('v1/ledgers/')
  }

  async function fetchOne(id: string) {
    activeLedger.value = await api.get<Ledger>(`v1/ledgers/${id}/`)
  }

  async function create(name: string, kind: Ledger['kind']) {
    const ledger = await api.post<Ledger>('v1/ledgers/', { name, kind })
    ledgers.value.push(ledger)
    return ledger
  }

  async function fetchMembers(id: string) {
    if (activeLedger.value?.id !== id) await fetchOne(id)
    return api.get<LedgerMember[]>(`v1/ledgers/${id}/members/`)
  }

  async function update(id: string, data: Partial<Pick<Ledger, 'name' | 'kind'>>) {
    const ledger = await api.patch<Ledger>(`v1/ledgers/${id}/`, data)
    const idx = ledgers.value.findIndex(l => l.id === id)
    if (idx >= 0) ledgers.value[idx] = ledger
    if (activeLedger.value?.id === id) activeLedger.value = ledger
    return ledger
  }

  async function createInvite(id: string, role: LedgerMember['role']) {
    return api.post<{ token: string }>(`v1/ledgers/${id}/invites/`, { role })
  }

  async function fetchInvite(token: string) {
    return api.get<InviteDetail>(`v1/invites/${token}/`)
  }

  async function acceptInvite(token: string) {
    return api.post<{ detail: string }>(`v1/invites/${token}/accept/`, {})
  }

  return { ledgers, activeLedger, fetchAll, fetchOne, create, update, fetchMembers, createInvite, fetchInvite, acceptInvite }
})
