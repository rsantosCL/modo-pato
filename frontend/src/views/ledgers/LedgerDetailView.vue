<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLedgersStore } from '@/stores/ledgers'

const { t } = useI18n()
const route = useRoute()
const store = useLedgersStore()
const loading = ref(true)

onMounted(async () => {
  try {
    await store.fetchOne(route.params.id as string)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main>
    <section :aria-busy="loading">
      <template v-if="!loading && store.activeLedger">
        <h2>{{ store.activeLedger.name }}</h2>
        <p>{{ t(`ledger.kind_${store.activeLedger.kind}`) }}</p>
        <router-link :to="`/ledgers/${store.activeLedger.id}/members`">{{ t('ledger.members') }}</router-link>
      </template>
    </section>
  </main>
</template>
