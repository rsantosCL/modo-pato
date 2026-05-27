import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLedgersStore } from '@/stores/ledgers'

export interface Crumb { label: string; to?: string }
type BreadcrumbFn = (route: RouteLocationNormalized, t: (k: string) => string) => Crumb[]

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    breadcrumbs?: BreadcrumbFn
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/auth/LoginView.vue'), meta: { public: true } },
    { path: '/signup', component: () => import('@/views/auth/SignupView.vue'), meta: { public: true } },
    {
      path: '/ledgers',
      component: () => import('@/views/ledgers/LedgersView.vue'),
      meta: {
        breadcrumbs: (_route, t) => [
          { label: t('ledger.title') },
        ],
      },
    },
    {
      path: '/ledgers/:id',
      component: () => import('@/views/ledgers/LedgerDetailView.vue'),
      meta: {
        breadcrumbs: (_route, t) => [
          { label: t('ledger.title'), to: '/ledgers' },
          { label: useLedgersStore().activeLedger?.name ?? '…' },
        ],
      },
    },
    {
      path: '/ledgers/:id/members',
      component: () => import('@/views/ledgers/LedgerMembersView.vue'),
      meta: {
        breadcrumbs: (route, t) => [
          { label: t('ledger.title'), to: '/ledgers' },
          { label: useLedgersStore().activeLedger?.name ?? '…', to: `/ledgers/${route.params.id}` },
          { label: t('ledger.members') },
        ],
      },
    },
    { path: '/:pathMatch(.*)*', redirect: '/ledgers' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) return '/login'
})

export default router
