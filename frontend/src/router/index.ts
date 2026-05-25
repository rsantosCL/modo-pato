import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/signup', component: () => import('@/views/SignupView.vue'), meta: { public: true } },
    { path: '/ledgers', component: () => import('@/views/LedgersView.vue') },
    { path: '/ledgers/:id', component: () => import('@/views/LedgerDetailView.vue') },
    { path: '/ledgers/:id/members', component: () => import('@/views/LedgerMembersView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/ledgers' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) return '/login'
})

export default router
