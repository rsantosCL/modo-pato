<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLedgersStore, type Ledger } from '@/stores/ledgers'

const { t } = useI18n()
const route = useRoute()
const store = useLedgersStore()
const loading = ref(true)
const editDialog = ref<HTMLDialogElement | null>(null)
const editName = ref('')
const editKind = ref<Ledger['kind']>('personal')
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    await store.fetchOne(route.params.id as string)
  } finally {
    loading.value = false
  }
})

function openEdit() {
  editName.value = store.activeLedger!.name
  editKind.value = store.activeLedger!.kind
  error.value = ''
  editDialog.value?.showModal()
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await store.update(route.params.id as string, { name: editName.value, kind: editKind.value })
    editDialog.value?.close()
  } catch {
    error.value = t('common.error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main>
    <section :aria-busy="loading">
      <template v-if="!loading && store.activeLedger">
        <h2>
          {{ store.activeLedger.name }}
          <sub>(<a href="#" @click.prevent="openEdit">{{ t('ledger.edit') }}</a>)</sub>
        </h2>
        <p>{{ t(`ledger.kind_${store.activeLedger.kind}`) }}</p>
        <router-link :to="`/ledgers/${store.activeLedger.id}/members`">{{ t('ledger.members') }}</router-link>
        &ensp;·&ensp;
        <router-link :to="`/ledgers/${store.activeLedger.id}/catalog`">{{ t('catalog.title') }}</router-link>
      </template>
    </section>
  </main>

  <dialog ref="editDialog">
    <article>
      <header>
        <button aria-label="Close" rel="prev" @click="editDialog?.close()"></button>
        <h3>{{ t('ledger.editTitle') }}</h3>
      </header>
      <form id="edit-ledger-form" @submit.prevent="save">
        <label>
          {{ t('ledger.name') }}
          <input v-model="editName" type="text" required autofocus />
        </label>
        <label>
          {{ t('ledger.kind') }}
          <select v-model="editKind">
            <option value="personal">{{ t('ledger.kind_personal') }}</option>
            <option value="shared">{{ t('ledger.kind_shared') }}</option>
          </select>
        </label>
        <p v-if="error" aria-live="polite">{{ error }}</p>
      </form>
      <footer>
        <button type="button" class="secondary" @click="editDialog?.close()">{{ t('common.cancel') }}</button>
        <button type="submit" form="edit-ledger-form" :aria-busy="saving">{{ t('common.save') }}</button>
      </footer>
    </article>
  </dialog>
</template>
