<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/ThemeToggle.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push('/login')
}

const breadcrumbs = computed(() => {
  if (!auth.isAuthenticated) return []
  return route.meta.breadcrumbs?.(route, t) ?? []
})
</script>

<template>
  <header>
    <nav>
      <ul>
        <li><strong>Modo Pato</strong></li>
      </ul>
      <ul v-if="auth.isAuthenticated">
        <ThemeToggle />
        <li class="nav-separator"><a href="#" @click.prevent="logout">{{ t('auth.logout') }}</a></li>
      </ul>
    </nav>
    <nav v-if="breadcrumbs.length" aria-label="breadcrumb">
      <ul>
        <li v-for="(crumb, i) in breadcrumbs" :key="i">
          <router-link v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</router-link>
          <span v-else>{{ crumb.label }}</span>
        </li>
      </ul>
    </nav>
  </header>
  <router-view />
</template>
