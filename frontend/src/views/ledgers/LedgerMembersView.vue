<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLedgersStore, type LedgerMember } from '@/stores/ledgers'

const { t } = useI18n()
const route = useRoute()
const store = useLedgersStore()

const members = ref<LedgerMember[]>([])
const inviteToken = ref('')
const inviteRole = ref<LedgerMember['role']>('editor')
const error = ref('')
const loading = ref(true)
const inviteDialog = ref<HTMLDialogElement | null>(null)

const ledgerId = route.params.id as string

onMounted(async () => {
  try {
    members.value = await store.fetchMembers(ledgerId)
  } finally {
    loading.value = false
  }
})

function openDialog() {
  inviteRole.value = 'editor'
  error.value = ''
  inviteDialog.value?.showModal()
}

async function invite() {
  error.value = ''
  try {
    const result = await store.createInvite(ledgerId, inviteRole.value)
    inviteToken.value = result.token
    inviteDialog.value?.close()
  } catch {
    error.value = t('common.error')
  }
}
</script>

<template>
  <main>
    <section>
      <h2>{{ t('ledger.members') }}</h2>
      <button @click="openDialog">{{ t('ledger.invite') }}</button>
      <div :aria-busy="loading">
        <table v-if="!loading && members.length">
          <thead>
            <tr>
              <th>{{ t('auth.displayName') }}</th>
              <th>{{ t('auth.email') }}</th>
              <th>{{ t('ledger.role') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.user_id">
              <td>{{ m.display_name }}</td>
              <td>{{ m.email }}</td>
              <td>{{ t(`ledger.role_${m.role}`) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="inviteToken">
        {{ t('ledger.inviteToken') }}: <code>{{ inviteToken }}</code>
      </p>
    </section>
  </main>

  <dialog ref="inviteDialog">
    <article>
      <header>
        <button aria-label="Close" rel="prev" @click="inviteDialog?.close()"></button>
        <h3>{{ t('ledger.invite') }}</h3>
      </header>
      <form id="invite-member-form" @submit.prevent="invite">
        <label>
          {{ t('ledger.role') }}
          <select v-model="inviteRole" autofocus>
            <option value="editor">{{ t('ledger.role_editor') }}</option>
            <option value="viewer">{{ t('ledger.role_viewer') }}</option>
          </select>
        </label>
        <p v-if="error" aria-live="polite">{{ error }}</p>
      </form>
      <footer>
        <button type="button" class="secondary" @click="inviteDialog?.close()">{{ t('common.cancel') }}</button>
        <button type="submit" form="invite-member-form">{{ t('ledger.invite') }}</button>
      </footer>
    </article>
  </dialog>
</template>
