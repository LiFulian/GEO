<template>
  <header class="app-topbar">
    <div class="topbar-title">
      <h2>{{ currentTitle }}</h2>
    </div>
    <div class="topbar-actions">
      <el-input
        v-model="searchQuery"
        placeholder="搜索产品/平台/文章…"
        class="search-input"
        @focus="openSearch"
        readonly
      >
        <template #append>
          <kbd class="shortcut">{{ shortcutKey }}</kbd>
        </template>
      </el-input>
      <el-tooltip :content="isDark ? '切换到浅色' : '切换到深色'" placement="bottom">
        <el-button :icon="isDark ? 'Sunny' : 'Moon'" circle size="small" @click="toggleTheme" />
      </el-tooltip>
      <el-tooltip content="刷新数据" placement="bottom">
        <el-button icon="Refresh" circle size="small" :loading="refreshing" @click="refresh" />
      </el-tooltip>
      <div class="user-info">
        <el-tag size="small" type="info" effect="plain">{{ currentModel }}</el-tag>
        <el-dropdown trigger="click">
          <el-button text size="small">
            {{ auth.userName }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/settings')">AI 设置</el-dropdown-item>
              <el-dropdown-item @click="exportBackup">导出备份</el-dropdown-item>
              <el-dropdown-item divided @click="logout">登出</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDataStore } from '@/stores/data'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { downloadFile } from '@/utils/helpers'
import { geoApi } from '@/api/client'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const data = useDataStore()
const { isDark, toggleTheme } = useTheme()
const { success, error } = useToast()

const searchQuery = ref('')
const refreshing = ref(false)
const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const shortcutKey = isMac ? '⌘K' : 'Ctrl+K'

const titleMap: Record<string, string> = {
  dashboard: '总览',
  products: '产品档案',
  workshop: '内容工坊',
  platforms: '发布平台',
  tasks: '发布记录',
  settings: 'AI 设置',
}

const currentTitle = computed(() => {
  const key = route.path.split('/')[1] || 'dashboard'
  return titleMap[key] || 'GEO Studio'
})

const currentModel = computed(() => {
  const ai = data.ai_settings
  if (!ai || !ai.text_model) return '未配置'
  return ai.text_model
})

function openSearch() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac }))
}

async function refresh() {
  refreshing.value = true
  try {
    await data.load()
    success('刷新成功')
  } catch (e: any) {
    error('刷新失败：' + e.message)
  } finally {
    refreshing.value = false
  }
}

function logout() {
  auth.logout()
  data.clear()
  router.push('/')
}

async function exportBackup() {
  try {
    const backup = await geoApi('/api/backup')
    const d = new Date().toISOString().slice(0, 10)
    const total = Object.values(backup).reduce((n: number, v: any) => n + (Array.isArray(v) ? v.length : 0), 0)
    downloadFile(`geo-backup-${d}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8')
    success(`已备份 ${total} 条记录`)
  } catch (e: any) {
    error('导出失败：' + e.message)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.app-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 52px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--geo-border);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.topbar-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-input {
  width: 280px;
  transition: all var(--geo-transition);
}

.search-input:hover {
  width: 320px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: var(--geo-radius);
  box-shadow: 0 0 0 1px var(--geo-border) inset;
}

.shortcut {
  font-size: 11px;
  color: var(--geo-text-muted);
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: var(--geo-radius-sm);
  font-family: inherit;
  font-weight: 500;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 12px;
  border-left: 1px solid var(--geo-border-light);
  margin-left: 4px;
}
</style>
