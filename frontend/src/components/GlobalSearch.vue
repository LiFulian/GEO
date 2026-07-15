<template>
  <el-dialog v-model="visible" title="全局搜索" width="600px" :show-close="true" @open="onOpen">
    <el-input
      ref="inputRef"
      v-model="query"
      placeholder="搜索产品、文章、平台、任务…"
      clearable
      @input="doSearch"
    />
    <div class="search-results" v-if="results.length">
      <div
        v-for="item in results"
        :key="item.type + item.id"
        class="search-item"
        @click="goTo(item)"
      >
        <el-tag size="small" :type="tagType(item.type)">{{ typeLabel(item.type) }}</el-tag>
        <span class="search-title">{{ item.title }}</span>
        <span class="search-desc muted">{{ item.desc }}</span>
      </div>
    </div>
    <el-empty v-else-if="query" description="未找到结果" />
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'

const router = useRouter()
const data = useDataStore()

const visible = ref(false)
const query = ref('')
const results = ref<{ type: string; id: string; title: string; desc: string }[]>([])
const inputRef = ref()

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

function onOpen() {
  nextTick(() => inputRef.value?.focus())
}

function handleKeydown(e: KeyboardEvent) {
  if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    visible.value = true
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

function doSearch() {
  const q = query.value.trim().toLowerCase()
  if (!q) { results.value = []; return }
  const r: { type: string; id: string; title: string; desc: string }[] = []
  for (const p of data.products) {
    if (((p.name || '') + (p.type || '') + (p.audience || '')).toLowerCase().includes(q))
      r.push({ type: 'product', id: p.id, title: p.name, desc: p.type })
  }
  for (const a of data.articles) {
    if (((a.title || '') + (a.summary || '') + (a.content_type || '')).toLowerCase().includes(q))
      r.push({ type: 'article', id: a.id, title: a.title, desc: a.content_type })
  }
  for (const p of data.platforms) {
    if (((p.name || '') + (p.category || '')).toLowerCase().includes(q))
      r.push({ type: 'platform', id: p.id, title: p.name, desc: p.category })
  }
  for (const t of data.tasks) {
    if (((t.article_title || '') + (t.platform_name || '')).toLowerCase().includes(q))
      r.push({ type: 'task', id: t.id, title: t.article_title || '任务', desc: t.platform_name || '' })
  }
  results.value = r.slice(0, 20)
}

function typeLabel(type: string) {
  return { product: '产品', article: '文章', platform: '平台', task: '任务' }[type] || type
}

function tagType(type: string): any {
  return { product: 'primary', article: 'success', platform: 'warning', task: 'info' }[type] || ''
}

function goTo(item: { type: string; id: string }) {
  const map: Record<string, string> = { product: 'products', article: 'workshop', platform: 'platforms', task: 'tasks' }
  const routeName = map[item.type]
  if (routeName) router.push(`/${routeName}/${item.id}`)
  visible.value = false
  query.value = ''
}
</script>

<style scoped>
.search-results {
  margin-top: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.search-item:hover {
  background: var(--el-fill-color-light);
}

.search-title {
  font-weight: 500;
}

.search-desc {
  font-size: 12px;
  margin-left: auto;
}

.muted {
  color: var(--el-text-color-secondary);
}
</style>
