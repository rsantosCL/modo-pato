import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAuthStore } from '../../src/stores/auth'

function makeRouter() {
  const { default: router } = require('../../src/router/index')
  return router
}

describe('router auth guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('redirects unauthenticated user to /login', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: { template: '<div />' }, meta: { public: true } },
        { path: '/ledgers', component: { template: '<div />' } },
      ],
    })
    router.beforeEach((to) => {
      const auth = useAuthStore()
      if (!to.meta.public && !auth.isAuthenticated) return '/login'
    })
    await router.push('/ledgers')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('allows authenticated user through', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: { template: '<div />' }, meta: { public: true } },
        { path: '/ledgers', component: { template: '<div />' } },
      ],
    })
    router.beforeEach((to) => {
      const auth = useAuthStore()
      if (!to.meta.public && !auth.isAuthenticated) return '/login'
    })
    const auth = useAuthStore()
    // simulate authenticated state
    localStorage.setItem('access_token', 'tok')
    ;(auth as any).accessToken = 'tok'
    await router.push('/ledgers')
    expect(router.currentRoute.value.path).toBe('/ledgers')
  })
})
