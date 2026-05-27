<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLedgersStore, type Ledger } from '@/stores/ledgers'

const { t } = useI18n()
const store = useLedgersStore()

const name = ref('')
const kind = ref<Ledger['kind']>('personal')
const error = ref('')
const loading = ref(true)
const createDialog = ref<HTMLDialogElement | null>(null)

onMounted(async () => {
  try {
    await store.fetchAll()
  } finally {
    loading.value = false
  }
})

function openDialog() {
  name.value = ''
  kind.value = 'personal'
  error.value = ''
  createDialog.value?.showModal()
}

async function create() {
  error.value = ''
  try {
    await store.create(name.value, kind.value)
    createDialog.value?.close()
  } catch {
    error.value = t('common.error')
  }
}
</script>

<template>
  <main>
    <section>
      <h2>{{ t('ledger.title') }}</h2>
      <button @click="openDialog">{{ t('ledger.create') }}</button>
    </section>

    <section :aria-busy="loading">
      <p v-if="!loading && !store.ledgers.length">{{ t('ledger.noLedgers') }}</p>
      <ul v-else-if="!loading">
        <li v-for="ledger in store.ledgers" :key="ledger.id">
          <router-link :to="`/ledgers/${ledger.id}`">{{ ledger.name }}</router-link>
          <small>
            — {{ t(`ledger.kind_${ledger.kind}`) }}
            (<router-link :to="`/ledgers/${ledger.id}/members`">{{ t('ledger.members') }}</router-link>)
          </small>
        </li>
      </ul>
    </section>
  </main>

  <dialog ref="createDialog">
    <article>
      <header>
        <button aria-label="Close" rel="prev" @click="createDialog?.close()"></button>
        <h3>{{ t('ledger.create') }}</h3>
      </header>
      <form id="create-ledger-form" @submit.prevent="create">
        <fieldset class="grid">
          <label>
            {{ t('ledger.name') }}
            <input v-model="name" type="text" required autofocus data-1p-ignore />
          </label>
          <label>
            {{ t('ledger.kind') }}
            <select v-model="kind">
              <option value="personal">{{ t('ledger.kind_personal') }}</option>
              <option value="shared">{{ t('ledger.kind_shared') }}</option>
            </select>
          </label>
        </fieldset>
        <p v-if="error" aria-live="polite">{{ error }}</p>
      </form>
      <footer>
        <button type="button" class="secondary" @click="createDialog?.close()">{{ t('common.cancel') }}</button>
        <button type="submit" form="create-ledger-form">{{ t('common.save') }}</button>
      </footer>
    </article>
  </dialog>
</template>
