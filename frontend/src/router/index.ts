import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDataStore } from '@/stores/data'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
  { path: '/products', name: 'products', component: () => import('@/views/ProductsView.vue') },
  { path: '/products/:id', component: () => import('@/views/ProductsView.vue') },
  { path: '/products/:id/:tab', component: () => import('@/views/ProductsView.vue') },
  { path: '/workshop', name: 'workshop', component: () => import('@/views/WorkshopView.vue') },
  { path: '/workshop/:id', component: () => import('@/views/WorkshopView.vue') },
  { path: '/platforms', name: 'platforms', component: () => import('@/views/PlatformsView.vue') },
  { path: '/platforms/:id', component: () => import('@/views/PlatformsView.vue') },
  { path: '/tasks', name: 'tasks', component: () => import('@/views/TasksView.vue') },
  { path: '/tasks/:tab', component: () => import('@/views/TasksView.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 路由守卫：未登录跳转首页（App.vue 会显示 AuthView）
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loggedIn) return true

  // 已登录但未加载数据，先加载
  const data = useDataStore()
  if (!data.isLoaded) {
    try {
      await data.load()
    } catch (e) {
      console.error('[GEO] 路由守卫加载数据失败：', e)
    }
  }

  // autoPickFirstItem：进入列表页时若未选中，自动跳到第一项
  // ?new=1 表示用户要新增，跳过自动选中
  if (to.query.new === '1') return true

  if (to.name === 'products' && !to.params.id && data.products.length > 0) {
    return { path: `/products/${data.products[0].id}` }
  }
  if (to.name === 'platforms' && !to.params.id && data.platforms.length > 0) {
    return { path: `/platforms/${data.platforms[0].id}` }
  }
  if (to.name === 'workshop' && !to.params.id && data.articles.length > 0) {
    return { path: `/workshop/${data.articles[0].id}` }
  }

  return true
})

export default router
