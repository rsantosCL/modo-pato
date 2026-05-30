<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: string
  required?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { locale, t } = useI18n()

const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i)

const monthNames = computed(() =>
  Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(new Date(2000, i, 1))
  )
)

const internalYear = ref(props.modelValue ? props.modelValue.slice(0, 4) : '')
const internalMonth = ref(props.modelValue ? props.modelValue.slice(5, 7) : '')

watch(() => props.modelValue, (val) => {
  internalYear.value = val ? val.slice(0, 4) : ''
  internalMonth.value = val ? val.slice(5, 7) : ''
})

watch([internalYear, internalMonth], ([y, m]) => {
  emit('update:modelValue', y && m ? `${y}-${m}` : '')
})

function setCurrentMonth() {
  const now = new Date()
  internalYear.value = String(now.getFullYear())
  internalMonth.value = String(now.getMonth() + 1).padStart(2, '0')
}

function clearMonth() {
  internalYear.value = ''
  internalMonth.value = ''
}
</script>

<template>
  <span class="month-picker">
    <span class="grid">
      <select v-model="internalYear" :required="required">
        <option value="">—</option>
        <option v-for="y in YEARS" :key="y" :value="String(y)">{{ y }}</option>
      </select>
      <select v-model="internalMonth" :required="required">
        <option value="">—</option>
        <option v-for="(name, idx) in monthNames" :key="idx" :value="String(idx + 1).padStart(2, '0')">{{ name }}</option>
      </select>
    </span>
    <small>
      <a href="#" @click.stop.prevent="setCurrentMonth">{{ t('common.currentMonth') }}</a>
      ·
      <a href="#" @click.stop.prevent="clearMonth">{{ t('common.clear') }}</a>
    </small>
  </span>
</template>
