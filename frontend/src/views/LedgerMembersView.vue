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

const ledgerId = route.params.id as string

onMounted(async () => {
  members.value = await store.fetchMembers(ledgerId)
})

async function invite() {
  error.value = ''
  try {
    const result = await store.createInvite(ledgerId, inviteRole.value)
    inviteToken.value = result.token
  } catch {
    error.value = t('common.error')
  }
}
</script>

<template>
  <main>
    <section>
      <h2>{{ t('ledger.members') }}</h2>
      <table v-if="members.length">
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
    </section>

    <section>
      <h3>{{ t('ledger.invite') }}</h3>
      <article>
        <form @submit.prevent="invite">
          <label>
            {{ t('ledger.role') }}
            <select v-model="inviteRole">
              <option value="editor">{{ t('ledger.role_editor') }}</option>
              <option value="viewer">{{ t('ledger.role_viewer') }}</option>
            </select>
          </label>
          <p v-if="error" aria-live="polite">{{ error }}</p>
          <input type="submit" :value="t('ledger.invite')" />
        </form>
      </article>
      <p v-if="inviteToken">
        {{ t('ledger.inviteToken') }}: <code>{{ inviteToken }}</code>
      </p>
    </section>
  </main>
</template>
