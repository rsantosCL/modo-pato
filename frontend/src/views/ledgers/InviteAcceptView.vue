<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLedgersStore, type InviteDetail } from '@/stores/ledgers'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useLedgersStore()

const token = route.params.token as string
const invite = ref<InviteDetail | null>(null)
const loading = ref(true)
const error = ref('')
const accepting = ref(false)

onMounted(async () => {
  try {
    invite.value = await store.fetchInvite(token)
  } catch {
    error.value = t('ledger.invalidInvite')
  } finally {
    loading.value = false
  }
})

async function accept() {
  accepting.value = true
  error.value = ''
  try {
    await store.acceptInvite(token)
    await store.fetchAll()
    router.push('/ledgers')
  } catch {
    error.value = t('common.error')
    accepting.value = false
  }
}
</script>

<template>
  <main>
    <article>
      <section :aria-busy="loading">
        <template v-if="!loading && invite">
          <h2>{{ t('ledger.acceptInvite') }}</h2>
          <p>
            <i18n-t keypath="ledger.inviteJoinAs">
              <template #name><mark>{{ invite.ledger_name }}</mark></template>
              <template #role><mark>{{ t(`ledger.role_${invite.role}`) }}</mark></template>
            </i18n-t>
          </p>
          <p>
            <i18n-t keypath="ledger.invitedBy">
              <template #name><mark>{{ invite.invited_by }}</mark></template>
            </i18n-t>
          </p>
          <p v-if="error" aria-live="polite">{{ error }}</p>
          <button :aria-busy="accepting" @click="accept">{{ t('ledger.acceptInvite') }}</button>
        </template>
        <p v-if="!loading && !invite" aria-live="polite">{{ error }}</p>
      </section>
    </article>
  </main>
</template>
