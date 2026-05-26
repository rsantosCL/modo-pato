<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header>
    <nav>
      <ul>
        <li><strong>Modo Pato</strong></li>
      </ul>
      <ul v-if="auth.isAuthenticated">
        <li><router-link to="/ledgers">{{ t('ledger.title') }}</router-link></li>
        <li><a href="#" @click.prevent="logout">{{ t('auth.logout') }}</a></li>
      </ul>
    </nav>
  </header>
  <router-view />
</template>
