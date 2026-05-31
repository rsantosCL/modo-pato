import { ref } from 'vue'
import { defineStore } from 'pinia'

type Theme = 'auto' | 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) ?? 'auto')

  function setTheme(t: Theme) {
    theme.value = t
    localStorage.setItem('theme', t)
    if (t === 'auto') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', t)
    }
  }

  return { theme, setTheme }
})
