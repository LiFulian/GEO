<template>
  <div class="split-layout">
    <!-- 侧边栏：按分类折叠 -->
    <div class="split-sidebar">
      <div class="sidebar-header">
        <h3>平台矩阵</h3>
        <el-button type="primary" size="small" @click="startAdd">+ 新增</el-button>
      </div>
      <el-input v-model="searchQuery" placeholder="搜索平台…" clearable size="small" class="sidebar-search" />
      <div class="sidebar-list">
        <template v-if="searchQuery">
          <div
            v-for="p in filteredPlatforms"
            :key="p.id"
            :class="['list-item', { active: p.id === selectedId }]"
            @click="selectPlatform(p.id)"
          >
            <span class="item-name">{{ p.name }}</span>
            <el-tag size="small" :type="statusType(p.status)" effect="light">{{ statusLabel(p.status) }}</el-tag>
          </div>
          <el-empty v-if="filteredPlatforms.length === 0" :image-size="48" description="无匹配" />
        </template>
        <template v-else>
          <div v-for="cat in groupedPlatforms" :key="cat.name" class="category-group">
            <div class="category-header" @click="toggleCategory(cat.name)">
              <el-icon class="cat-chevron" :class="{ expanded: expandedCategories.has(cat.name) }"><ArrowRight /></el-icon>
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-count">{{ cat.platforms.length }}</span>
            </div>
            <div v-show="expandedCategories.has(cat.name)" class="category-items">
              <div
                v-for="p in cat.platforms"
                :key="p.id"
                :class="['list-item', { active: p.id === selectedId }]"
                @click="selectPlatform(p.id)"
              >
                <span class="item-name">{{ p.name }}</span>
                <el-tag size="small" :type="statusType(p.status)" effect="light">{{ statusLabel(p.status) }}</el-tag>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 主区域：统一布局，查看/编辑共用 grid -->
    <div class="split-main">
      <div v-if="!selectedPlatform && !isAdding" class="empty-center">
        <el-empty description="选择左侧平台查看详情" />
      </div>
      <div v-else class="platform-detail">
        <!-- AI 填充条（仅新增模式） -->
        <div v-if="isAdding" class="ai-fill-bar">
          <el-input
            v-model="aiInput"
            placeholder="输入平台名称或公司名，如：知乎、小红书、掘金…"
            @keyup.enter="aiFill"
          />
          <el-button type="primary" @click="aiFill" :loading="aiLoading">
            <el-icon><MagicStick /></el-icon> AI 填充
          </el-button>
        </div>
        <div v-if="aiLoading" class="ai-fill-status">
          <el-icon :class="{'is-loading': true}"><Loading /></el-icon>
          <span>{{ aiStatusText }}</span>
        </div>

        <!-- 头部：标题 + 操作按钮 -->
        <div class="detail-header">
          <div class="detail-title">
            <h2 v-if="!isEditingMode">{{ selectedPlatform?.name || '新增平台' }}</h2>
            <el-input v-else v-model="formData.name" class="title-input" placeholder="平台名称" />
          </div>
          <div class="detail-actions">
            <template v-if="!isEditingMode">
              <el-button size="small" @click="openUrl(selectedPlatform?.url || '')" :disabled="!selectedPlatform?.url">打开 ↗</el-button>
              <el-button size="small" @click="toggleStatus">{{ selectedPlatform?.status === 'enabled' ? '停用' : '启用' }}</el-button>
              <el-button size="small" type="primary" @click="startEdit">编辑</el-button>
              <el-button size="small" type="danger" plain @click="deletePlatform">删除</el-button>
            </template>
            <template v-else>
              <el-button size="small" @click="cancelEdit">取消</el-button>
              <el-button size="small" type="primary" @click="save" :loading="saving">保存</el-button>
            </template>
          </div>
        </div>

        <!-- 统一网格：查看/编辑共用同一布局，字段位置不变 -->
        <div class="detail-grid">
          <!-- 分类 -->
          <div class="detail-field">
            <label>分类</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.category || '未分类' }}</span>
              <el-select v-else v-model="formData.category" filterable allow-create default-first-option placeholder="选择或输入新分类" size="small">
                <el-option v-for="cat in existingCategories" :key="cat" :label="cat" :value="cat" />
              </el-select>
            </div>
          </div>
          <!-- 状态 -->
          <div class="detail-field">
            <label>状态</label>
            <div class="field-value">
              <el-tag v-if="!isEditingMode" :type="statusType(selectedPlatform?.status || 'enabled')" effect="light">{{ statusLabel(selectedPlatform?.status || 'enabled') }}</el-tag>
              <el-select v-else v-model="formData.status" size="small">
                <el-option label="启用" value="enabled" />
                <el-option label="观察" value="watch" />
                <el-option label="停用" value="disabled" />
              </el-select>
            </div>
          </div>
          <!-- 发布入口 -->
          <div class="detail-field">
            <label>发布入口</label>
            <div class="field-value">
              <el-link v-if="!isEditingMode && selectedPlatform?.url" :href="selectedPlatform.url" target="_blank" type="primary">{{ selectedPlatform.url }}</el-link>
              <span v-else-if="!isEditingMode" class="placeholder">未配置</span>
              <el-input v-else v-model="formData.url" placeholder="https://" size="small" />
            </div>
          </div>
          <!-- 账号名称 -->
          <div class="detail-field">
            <label>账号名称</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.account_name || '—' }}</span>
              <el-input v-else v-model="formData.account_name" size="small" />
            </div>
          </div>
          <!-- 适合内容 -->
          <div class="detail-field full-width">
            <label>适合内容</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.content_style || '—' }}</span>
              <el-input v-else v-model="formData.content_style" type="textarea" :rows="2" size="small" />
            </div>
          </div>
          <!-- 推荐字数 -->
          <div class="detail-field">
            <label>推荐字数</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.recommended_words || '—' }}</span>
              <el-input v-else v-model="formData.recommended_words" size="small" />
            </div>
          </div>
          <!-- 标题风格 -->
          <div class="detail-field">
            <label>标题风格</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.title_style || '—' }}</span>
              <el-input v-else v-model="formData.title_style" size="small" />
            </div>
          </div>
          <!-- 标签规则 -->
          <div class="detail-field">
            <label>标签规则</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.tags_rule || '—' }}</span>
              <el-input v-else v-model="formData.tags_rule" size="small" />
            </div>
          </div>
          <!-- 外链限制 -->
          <div class="detail-field">
            <label>外链限制</label>
            <div class="field-value">
              <el-tag v-if="!isEditingMode" size="small" effect="plain" :type="linkTagType(selectedPlatform?.allows_external_links || 'limited')">{{ linkLabel(selectedPlatform?.allows_external_links || 'limited') }}</el-tag>
              <el-select v-else v-model="formData.allows_external_links" size="small">
                <el-option label="允许外链" value="allowed" />
                <el-option label="有限外链" value="limited" />
                <el-option label="禁止外链" value="forbidden" />
              </el-select>
            </div>
          </div>
          <!-- 软文适配 -->
          <div class="detail-field">
            <label>软文适配</label>
            <div class="field-value">
              <el-tag v-if="!isEditingMode" size="small" effect="plain" :type="fitTagType(selectedPlatform?.soft_article_fit || 'medium')">{{ fitLabel(selectedPlatform?.soft_article_fit || 'medium') }}</el-tag>
              <el-select v-else v-model="formData.soft_article_fit" size="small">
                <el-option label="高适配" value="high" />
                <el-option label="中适配" value="medium" />
                <el-option label="低适配" value="low" />
              </el-select>
            </div>
          </div>
          <!-- 发布频率 -->
          <div class="detail-field">
            <label>发布频率</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.frequency || '—' }}</span>
              <el-input v-else v-model="formData.frequency" size="small" />
            </div>
          </div>
          <!-- 登录提示 -->
          <div class="detail-field">
            <label>登录提示</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.login_notes || '—' }}</span>
              <el-input v-else v-model="formData.login_notes" size="small" />
            </div>
          </div>
          <!-- 备注 -->
          <div class="detail-field full-width">
            <label>备注</label>
            <div class="field-value">
              <span v-if="!isEditingMode" class="value-text">{{ selectedPlatform?.notes || '—' }}</span>
              <el-input v-else v-model="formData.notes" type="textarea" :rows="2" size="small" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Loading, MagicStick } from '@element-plus/icons-vue'
import { useDataStore } from '@/stores/data'
import { useToast } from '@/composables/useToast'
import { geoApi } from '@/api/client'
import { callAIStream } from '@/api/ai'
import { buildPlatformProfilePrompt, extractJsonObject } from '@/utils/ai-prompts'
import type { Platform, PlatformStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const { success, error: showError, confirm } = useToast()

const searchQuery = ref('')
const isEditing = ref(false)
const isAdding = ref(false)
const saving = ref(false)

// AI 填充
const aiInput = ref('')
const aiLoading = ref(false)
const aiStatusText = ref('')

const selectedId = computed(() => route.params.id as string || '')
const selectedPlatform = computed(() => data.platforms.find(p => p.id === selectedId.value))
const isEditingMode = computed(() => isEditing.value || isAdding.value)

// ===== 分类折叠 =====
const expandedCategories = ref(new Set<string>())

const groupedPlatforms = computed(() => {
  const groups: { name: string; platforms: Platform[] }[] = []
  const map = new Map<string, Platform[]>()
  for (const p of data.platforms) {
    const cat = p.category || '未分类'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(p)
  }
  for (const [name, platforms] of map) {
    groups.push({ name, platforms })
  }
  return groups
})

// 已有分类列表（用于 el-select 选项）
const existingCategories = computed(() => {
  const set = new Set<string>()
  for (const p of data.platforms) {
    if (p.category) set.add(p.category)
  }
  return Array.from(set).sort()
})

function toggleCategory(name: string) {
  if (expandedCategories.value.has(name)) {
    expandedCategories.value.delete(name)
  } else {
    expandedCategories.value.add(name)
  }
}

watch(selectedId, (id) => {
  if (!id) return
  const p = data.platforms.find(x => x.id === id)
  if (p) expandedCategories.value.add(p.category || '未分类')
}, { immediate: true })

const filteredPlatforms = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return data.platforms
  return data.platforms.filter(p => (p.name + p.category).toLowerCase().includes(q))
})

// ===== 表单 =====
const formData = reactive<Partial<Platform>>({
  name: '', category: '', url: '', account_name: '', login_notes: '',
  content_style: '', recommended_words: '', title_style: '', tags_rule: '',
  allows_external_links: 'limited', soft_article_fit: 'medium', frequency: '',
  status: 'enabled', notes: '',
})

function selectPlatform(id: string) {
  isEditing.value = false
  isAdding.value = false
  router.push(`/platforms/${id}`)
}

function startAdd() {
  isAdding.value = true
  isEditing.value = false
  aiInput.value = ''
  Object.assign(formData, {
    name: '', category: '', url: '', account_name: '', login_notes: '',
    content_style: '', recommended_words: '', title_style: '', tags_rule: '',
    allows_external_links: 'limited', soft_article_fit: 'medium', frequency: '',
    status: 'enabled', notes: '',
  })
  // 带 ?new=1 跳过路由守卫的 autoPickFirstItem
  if (route.query.new !== '1') {
    router.push({ path: '/platforms', query: { new: '1' } })
  }
}

// 从 Dashboard 快捷操作跳转过来时自动进入新增模式
onMounted(() => {
  if (route.query.new === '1' && !route.params.id) startAdd()
})

function startEdit() {
  if (!selectedPlatform.value) return
  isEditing.value = true
  isAdding.value = false
  Object.assign(formData, selectedPlatform.value)
}

function cancelEdit() {
  const wasAdding = isAdding.value
  isEditing.value = false
  isAdding.value = false
  if (wasAdding) {
    if (data.platforms.length > 0) router.push(`/platforms/${data.platforms[0].id}`)
    else router.push('/platforms')
  }
}

async function save() {
  if (!formData.name) { showError('请填写名称'); return }
  saving.value = true
  try {
    if (isEditing.value && selectedPlatform.value) {
      const updated = await geoApi(`/api/platforms/${selectedPlatform.value.id}`, { method: 'PATCH', body: formData })
      const idx = data.platforms.findIndex(p => p.id === selectedPlatform.value!.id)
      if (idx >= 0) data.platforms[idx] = updated
      success('已保存')
      isEditing.value = false
    } else {
      const created = await geoApi('/api/platforms', { method: 'POST', body: formData })
      data.platforms.push(created)
      success('已创建')
      isAdding.value = false
      expandedCategories.value.add(created.category || '未分类')
      router.push(`/platforms/${created.id}`)
    }
  } catch (e: any) {
    showError('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function deletePlatform() {
  if (!selectedPlatform.value) return
  if (!await confirm(`确认删除平台「${selectedPlatform.value.name}」？`)) return
  try {
    await geoApi(`/api/platforms/${selectedPlatform.value.id}`, { method: 'DELETE' })
    data.platforms = data.platforms.filter(p => p.id !== selectedPlatform.value!.id)
    success('已删除')
    if (data.platforms.length > 0) router.push(`/platforms/${data.platforms[0].id}`)
    else router.push('/platforms')
  } catch (e: any) {
    showError('删除失败：' + e.message)
  }
}

async function toggleStatus() {
  if (!selectedPlatform.value) return
  const newStatus: PlatformStatus = selectedPlatform.value.status === 'enabled' ? 'disabled' : 'enabled'
  try {
    const updated = await geoApi(`/api/platforms/${selectedPlatform.value.id}`, { method: 'PATCH', body: { status: newStatus } })
    const idx = data.platforms.findIndex(p => p.id === selectedPlatform.value!.id)
    if (idx >= 0) data.platforms[idx] = updated
    success(`已${newStatus === 'enabled' ? '启用' : '停用'}`)
  } catch (e: any) {
    showError('操作失败：' + e.message)
  }
}

// AI 一键填充
async function aiFill() {
  if (!aiInput.value.trim()) { showError('请输入平台名称或公司名'); return }
  aiLoading.value = true
  aiStatusText.value = '正在搜索平台信息…'
  try {
    const prompt = buildPlatformProfilePrompt(aiInput.value.trim())
    let raw = ''
    await callAIStream(data.ai_settings, [{ role: 'user', content: prompt }], {
      onThinking: () => {
        aiStatusText.value = '分析平台特征中…'
      },
      onContent: (t) => {
        raw = t
        aiStatusText.value = '整理字段中…'
      },
    })
    const result = extractJsonObject(raw)
    aiStatusText.value = '填充表单中…'
    await new Promise(r => setTimeout(r, 200))
    Object.assign(formData, {
      name: result.name || aiInput.value.trim(),
      category: result.category || '',
      url: result.url || '',
      account_name: result.account_name || '',
      content_style: result.content_style || '',
      recommended_words: result.recommended_words || '',
      title_style: result.title_style || '',
      tags_rule: result.tags_rule || '',
      allows_external_links: result.allows_external_links || 'limited',
      soft_article_fit: result.soft_article_fit || 'medium',
      frequency: result.frequency || '',
      login_notes: result.login_notes || '',
      notes: result.notes || '',
      status: 'enabled',
    })
    success('AI 填充完成，请检查并修改')
  } catch (e: any) {
    showError('AI 填充失败：' + e.message)
  } finally {
    aiLoading.value = false
    aiStatusText.value = ''
  }
}

function openUrl(url: string) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function statusLabel(status: PlatformStatus) {
  return { enabled: '启用', watch: '观察', disabled: '停用' }[status] || status
}

function statusType(status: PlatformStatus): any {
  return { enabled: 'success', watch: 'warning', disabled: 'info' }[status] || 'info'
}

function linkLabel(val: string) {
  return { allowed: '允许外链', limited: '有限外链', forbidden: '禁止外链' }[val] || val
}

function linkTagType(val: string): any {
  return { allowed: 'success', limited: 'warning', forbidden: 'danger' }[val] || 'info'
}

function fitLabel(val: string) {
  return { high: '高适配', medium: '中适配', low: '低适配' }[val] || val
}

function fitTagType(val: string): any {
  return { high: 'success', medium: 'warning', low: 'info' }[val] || 'info'
}
</script>

<style scoped>
/* 分类折叠 */
.category-group { margin-bottom: 2px; }

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
}

.category-header:hover { background: var(--el-fill-color-light); }

.cat-chevron { transition: transform 0.2s; font-size: 12px; }
.cat-chevron.expanded { transform: rotate(90deg); }
.cat-name { flex: 1; }
.cat-count {
  font-size: 11px;
  color: var(--el-text-color-disabled);
  background: var(--el-fill-color);
  padding: 1px 6px;
  border-radius: 8px;
}

/* 列表项：分类缩进需额外左 padding */
.list-item { padding: 8px 14px 8px 28px; }

/* 平台详情区 */
.platform-detail { min-height: 100%; }

/* AI 填充条 */
.ai-fill-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #eef2ff, #f0f9ff);
  border: 1px solid #c7d2fe;
  border-radius: var(--geo-radius-lg);
  margin-bottom: 16px;
}

.ai-fill-bar .el-input { flex: 1; }

.ai-fill-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-radius: var(--geo-radius-md);
  margin-bottom: 12px;
  font-size: 13px;
}

/* 详情头部对齐方式 */
.detail-header { align-items: center; }
</style>
