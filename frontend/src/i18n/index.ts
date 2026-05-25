import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import esCL from './locales/es-CL.json'

const locale = navigator.language.startsWith('es') ? 'es-CL' : 'en'

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'es-CL',
  messages: { en, 'es-CL': esCL },
})
