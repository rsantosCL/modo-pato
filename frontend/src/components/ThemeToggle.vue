<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'

const { t } = useI18n()
const themeStore = useThemeStore()

type ThemeOption = 'auto' | 'light' | 'dark'
const options: ThemeOption[] = ['auto', 'light', 'dark']
</script>

<template>
  <li v-for="opt in options" :key="opt" class="theme-option">
    <a
      href="#"
      :aria-current="themeStore.theme === opt ? 'true' : undefined"
      @click.prevent="themeStore.setTheme(opt)"
    >{{ t(`theme.${opt}`) }}</a>
  </li>
</template>
