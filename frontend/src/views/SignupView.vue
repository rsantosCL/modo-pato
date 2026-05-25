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
const displayName = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    await auth.signup(email.value, password.value, displayName.value)
    router.push('/ledgers')
  } catch {
    error.value = t('common.error')
  }
}
</script>

<template>
  <main>
    <article>
      <h2>{{ t('auth.signup') }}</h2>
      <form @submit.prevent="submit">
        <label>
          {{ t('auth.displayName') }}
          <input v-model="displayName" type="text" required autocomplete="name" />
        </label>
        <label>
          {{ t('auth.email') }}
          <input v-model="email" type="email" required autocomplete="email" />
        </label>
        <label>
          {{ t('auth.password') }}
          <input v-model="password" type="password" required autocomplete="new-password" minlength="8" />
        </label>
        <p v-if="error" aria-live="polite">{{ error }}</p>
        <button type="submit">{{ t('auth.signup') }}</button>
      </form>
      <p>{{ t('auth.alreadyAccount') }} <router-link to="/login">{{ t('auth.login') }}</router-link></p>
    </article>
  </main>
</template>
