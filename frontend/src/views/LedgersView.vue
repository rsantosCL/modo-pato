<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLedgersStore, type Ledger } from '@/stores/ledgers'

const { t } = useI18n()
const store = useLedgersStore()

const name = ref('')
const kind = ref<Ledger['kind']>('personal')
const error = ref('')
const showForm = ref(false)

onMounted(() => store.fetchAll())

async function create() {
  error.value = ''
  try {
    await store.create(name.value, kind.value)
    name.value = ''
    showForm.value = false
  } catch {
    error.value = t('common.error')
  }
}
</script>

<template>
  <main>
    <header>
      <h2>{{ t('ledger.title') }}</h2>
      <button @click="showForm = !showForm">{{ t('ledger.create') }}</button>
    </header>

    <article v-if="showForm">
      <form @submit.prevent="create">
        <label>
          {{ t('ledger.name') }}
          <input v-model="name" type="text" required />
        </label>
        <label>
          {{ t('ledger.kind') }}
          <select v-model="kind">
            <option value="personal">{{ t('ledger.kind_personal') }}</option>
            <option value="shared">{{ t('ledger.kind_shared') }}</option>
          </select>
        </label>
        <p v-if="error" aria-live="polite">{{ error }}</p>
        <button type="submit">{{ t('common.save') }}</button>
        <button type="button" @click="showForm = false">{{ t('common.cancel') }}</button>
      </form>
    </article>

    <p v-if="!store.ledgers.length">{{ t('ledger.noLedgers') }}</p>

    <ul v-else>
      <li v-for="ledger in store.ledgers" :key="ledger.id">
        <router-link :to="`/ledgers/${ledger.id}`">{{ ledger.name }}</router-link>
        <small> — {{ t(`ledger.kind_${ledger.kind}`) }}</small>
        <router-link :to="`/ledgers/${ledger.id}/members`">{{ t('ledger.members') }}</router-link>
      </li>
    </ul>
  </main>
</template>
