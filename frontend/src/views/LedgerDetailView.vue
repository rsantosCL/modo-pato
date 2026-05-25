<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLedgersStore } from '@/stores/ledgers'

const { t } = useI18n()
const route = useRoute()
const store = useLedgersStore()

onMounted(() => store.fetchOne(route.params.id as string))
</script>

<template>
  <main>
    <p v-if="!store.activeLedger">{{ t('common.loading') }}</p>
    <template v-else>
      <h2>{{ store.activeLedger.name }}</h2>
      <p>{{ t(`ledger.kind_${store.activeLedger.kind}`) }}</p>
      <router-link :to="`/ledgers/${store.activeLedger.id}/members`">{{ t('ledger.members') }}</router-link>
    </template>
  </main>
</template>
