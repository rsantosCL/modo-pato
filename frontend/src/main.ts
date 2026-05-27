import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@picocss/pico/css/pico.min.css'
import './app.css'
import { i18n } from './i18n'
import router from './router'
import App from './App.vue'

createApp(App).use(createPinia()).use(i18n).use(router).mount('#app')
