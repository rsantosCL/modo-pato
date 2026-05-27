import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api, ApiError } from '@/lib/api'

interface User {
  id: string
  email: string
  display_name: string
  created_at: string
}

interface TokenPair {
  access: string
  refresh: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'))

  const isAuthenticated = computed(() => !!accessToken.value)

  function setTokens(tokens: TokenPair) {
    accessToken.value = tokens.access
    refreshToken.value = tokens.refresh
    localStorage.setItem('access_token', tokens.access)
    localStorage.setItem('refresh_token', tokens.refresh)
  }

  async function login(email: string, password: string) {
    const tokens = await api.post<TokenPair>('v1/auth/login/', { email, password })
    setTokens(tokens)
  }

  async function signup(email: string, password: string, display_name: string) {
    await api.post<User>('v1/auth/signup/', { email, password, display_name })
    await login(email, password)
  }

  async function refresh() {
    if (!refreshToken.value) throw new ApiError(401, 'No refresh token')
    const tokens = await api.post<TokenPair>('v1/auth/refresh/', { refresh: refreshToken.value })
    setTokens(tokens)
  }

  function logout() {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  return { user, accessToken, isAuthenticated, login, signup, refresh, logout }
})
