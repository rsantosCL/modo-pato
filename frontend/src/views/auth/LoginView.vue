<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    await auth.login(email.value, password.value)
    router.push('/ledgers')
  } catch {
    error.value = t('common.error')
  }
}
</script>

<template>
  <main>
    <article>
      <h2>{{ t('auth.login') }}</h2>
      <form @submit.prevent="submit">
        <label>
          {{ t('auth.email') }}
          <input v-model="email" type="email" required autocomplete="email" />
        </label>
        <label>
          {{ t('auth.password') }}
          <input v-model="password" type="password" required autocomplete="current-password" />
        </label>
        <p v-if="error" aria-live="polite">{{ error }}</p>
        <input type="submit" :value="t('auth.login')" />
      </form>
      <p>{{ t('auth.noAccount') }} <router-link to="/signup">{{ t('auth.signup') }}</router-link></p>
    </article>
  </main>
</template>
