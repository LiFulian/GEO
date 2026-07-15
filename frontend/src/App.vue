<template>
  <div class="app-layout">
    <AppSidebar v-if="auth.loggedIn" />
    <div class="app-main">
      <AppTopbar v-if="auth.loggedIn" />
      <div :class="['app-content', { 'split-view': isSplitView }]">
        <router-view />
      </div>
    </div>
    <AuthView v-if="!auth.loggedIn" />
    <FatalError v-if="fatalError" :message="fatalError" @retry="bootstrapApp" />
    <GlobalSearch v-if="auth.loggedIn" />
    <GlobalAi v-if="auth.loggedIn" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDataStore } from '@/stores/data'
import { useTheme } from '@/composables/useTheme'
import { useAchievements } from '@/composables/useAchievements'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopbar from '@/components/AppTopbar.vue'
import AuthView from '@/components/AuthView.vue'
import FatalError from '@/components/FatalError.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import GlobalAi from '@/components/GlobalAi.vue'

const route = useRoute()
const auth = useAuthStore()
const data = useDataStore()
const { initTheme } = useTheme()
const { checkAchievements } = useAchievements()
const fatalError = ref('')

// 分屏视图（产品/平台/工坊）去掉外层 padding，占满全屏
const isSplitView = computed(() => {
  const p = route.path
  return p.startsWith('/products') || p.startsWith('/platforms') || p.startsWith('/workshop')
})

async function bootstrapApp() {
  fatalError.value = ''
  if (!auth.loggedIn) return
  try {
    await data.load()
    checkAchievements()
  } catch (err: any) {
    console.error('[GEO] 初始加载失败：', err)
    fatalError.value = (err && err.message) ? err.message : '无法连接后台服务，请确认 PocketBase 已启动。'
  }
}

// 数据变化时检查成就（发布任务、产品、文章增减）
watch(() => data.tasks.length, () => checkAchievements())
watch(() => data.products.length, () => checkAchievements())
watch(() => data.articles.length, () => checkAchievements())

onMounted(() => {
  initTheme()
  bootstrapApp()
})
</script>
