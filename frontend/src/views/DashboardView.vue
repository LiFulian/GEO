<template>
  <div class="dashboard">
    <!-- 紧凑 hero -->
    <div class="hero">
      <div class="hero-left">
        <span class="hero-eyebrow"><span class="dot"></span>AI Powered GEO Workspace</span>
        <h2>让 AI 帮你回答用户真正会问的问题</h2>
        <p class="hero-desc">从产品档案到 GEO 问题、内容生成、发布记录，一站式管理你的生成式搜索优化链路。</p>
      </div>
      <div class="hero-right">
        <span class="hero-date">{{ today }}</span>
      </div>
    </div>

    <!-- 统计卡片：图标 + 色彩区分 -->
    <div class="stats">
      <div class="stat-card stat-products" @click="router.push('/products')">
        <div class="stat-icon"><el-icon><Box /></el-icon></div>
        <div class="stat-body">
          <small>产品</small>
          <span class="stat-num">{{ data.products.length }}</span>
        </div>
      </div>
      <div class="stat-card stat-questions" @click="router.push('/products')">
        <div class="stat-icon"><el-icon><QuestionFilled /></el-icon></div>
        <div class="stat-body">
          <small>GEO 问题</small>
          <span class="stat-num">{{ data.geo_questions.length }}</span>
        </div>
      </div>
      <div class="stat-card stat-articles" @click="router.push('/workshop')">
        <div class="stat-icon"><el-icon><Document /></el-icon></div>
        <div class="stat-body">
          <small>文章</small>
          <span class="stat-num">{{ data.articles.length }}</span>
        </div>
      </div>
      <div class="stat-card stat-tasks" @click="router.push('/tasks')">
        <div class="stat-icon"><el-icon><Calendar /></el-icon></div>
        <div class="stat-body">
          <small>发布任务</small>
          <span class="stat-num">{{ data.tasks.length }}</span>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-actions">
      <el-button @click="router.push('/products?new=1')">
        <el-icon><Box /></el-icon><span>新建产品</span>
      </el-button>
      <el-button @click="router.push('/workshop')">
        <el-icon><EditPen /></el-icon><span>生成内容</span>
      </el-button>
      <el-button @click="router.push('/platforms?new=1')">
        <el-icon><Grid /></el-icon><span>新建平台</span>
      </el-button>
      <el-button @click="router.push('/tasks')">
        <el-icon><Calendar /></el-icon><span>发布任务</span>
      </el-button>
    </div>

    <!-- AI Skills -->
    <el-card shadow="never" class="section-card skills-card">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">AI Skills</span>
            <span class="muted">装载知识模板，让 AI 帮你做具体的事</span>
          </div>
          <el-button size="small" type="primary" :icon="Plus" @click="createSkill">新建 Skill</el-button>
        </div>
      </template>
      <div v-if="data.skills.length === 0" class="skills-empty">
        <el-empty description="加载中..." :image-size="50" />
      </div>
      <div v-else class="skills-grid">
        <div v-for="skill in data.skills" :key="skill.id" class="skill-card" @click="openSkill(skill)">
          <div class="skill-head">
            <span class="skill-cat" :style="{ background: catColor(skill.category) }">{{ skill.category || '未分类' }}</span>
            <el-tag v-if="skill.is_preset" size="small" type="info" effect="light">预设</el-tag>
          </div>
          <h4 class="skill-name">{{ skill.name }}</h4>
          <p class="skill-desc">{{ skill.description }}</p>
        </div>
      </div>
    </el-card>

    <!-- 覆盖概览 -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">GEO 覆盖概览</span>
          <span class="muted">{{ coverageText }}</span>
        </div>
      </template>
      <div v-if="data.coverage.by_product.length === 0">
        <el-empty description="暂无覆盖率数据" :image-size="60" />
      </div>
      <div v-else class="coverage-list">
        <div v-for="p in data.coverage.by_product" :key="p.product_id" class="coverage-item">
          <span class="coverage-name">{{ p.product_name }}</span>
          <el-progress :percentage="Math.round(p.rate * 100)" :format="() => `${p.covered_q}/${p.total_q}`" style="flex: 1; margin: 0 12px" />
          <el-tag v-if="p.gaps.length" size="small" type="danger" effect="light">{{ p.gaps.length }} 个缺口</el-tag>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <el-card shadow="never" class="section-card">
          <template #header><span class="card-title">高优先级 GEO 问题</span></template>
          <div v-if="topQuestions.length === 0"><el-empty description="暂无" :image-size="60" /></div>
          <div v-else>
            <div v-for="q in topQuestions" :key="q.id" class="compact-item" @click="router.push(`/products/${q.product_id}`)">
              <el-tag size="small" type="danger" effect="light">高</el-tag>
              <span class="compact-text">{{ q.question }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="section-card">
          <template #header><span class="card-title">最近文章</span></template>
          <div v-if="recentArticles.length === 0"><el-empty description="暂无" :image-size="60" /></div>
          <div v-else>
            <div v-for="a in recentArticles" :key="a.id" class="compact-item" @click="router.push(`/workshop/${a.id}`)">
              <el-tag size="small" :type="statusTagType(a.status)" effect="light">{{ statusLabel(a.status) }}</el-tag>
              <span class="compact-text">{{ a.title }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Skill 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="Skill 详情" size="600px" direction="rtl">
      <template v-if="currentSkill" #header>
        <div class="drawer-title">
          <span class="skill-cat" :style="{ background: catColor(currentSkill.category) }">{{ currentSkill.category || '未分类' }}</span>
          <h3>{{ currentSkill.name }}</h3>
          <el-tag v-if="currentSkill.is_preset" size="small" type="info" effect="light">系统预设</el-tag>
        </div>
      </template>
      <div v-if="currentSkill" class="skill-detail">
        <div class="skill-desc-full">{{ currentSkill.description }}</div>
        <div class="skill-content">
          <div v-if="!editing" class="md-preview" v-html="renderedContent"></div>
          <el-input v-else v-model="editContent" type="textarea" :rows="20" placeholder="用 Markdown 编写 Skill 内容..." />
        </div>
        <div class="skill-actions">
          <el-button v-if="!editing" type="primary" :icon="MagicStick" @click="applySkill" :loading="applying">
            用 AI 应用此 Skill
          </el-button>
          <template v-if="currentSkill.is_preset">
            <el-button v-if="!editing" :icon="CopyDocument" @click="cloneSkill">克隆为自定义</el-button>
          </template>
          <template v-else>
            <el-button v-if="!editing" :icon="Edit" @click="startEdit">编辑</el-button>
            <template v-else>
              <el-button type="success" :icon="Check" @click="saveSkill" :loading="saving">保存</el-button>
              <el-button @click="cancelEdit">取消</el-button>
            </template>
            <el-button v-if="!editing" type="danger" :icon="Delete" @click="deleteSkill">删除</el-button>
          </template>
        </div>

        <!-- AI 应用输入区 -->
        <div v-if="showApplyInput" class="apply-section">
          <el-divider>AI 应用</el-divider>
          <el-input
            v-model="applyInput"
            type="textarea"
            :rows="3"
            placeholder="输入你的主题/需求，比如：帮我构思一个面向独立开发者的 AI 工具产品"
          />
          <div class="apply-actions">
            <el-button type="primary" :icon="MagicStick" @click="runApply" :loading="applying">
              {{ applying ? 'AI 生成中...' : '开始生成' }}
            </el-button>
            <el-button @click="showApplyInput = false">收起</el-button>
          </div>
          <div v-if="applyResult || applying" class="apply-result">
            <div v-if="applyThinking" class="apply-thinking">
              <div class="thinking-bar">
                <el-icon><Star /></el-icon>
                <span>{{ applyThinkingDone ? '思考完成' : '正在思考…' }}</span>
              </div>
              <div class="thinking-content" v-html="markdownToHtml(applyThinking)"></div>
            </div>
            <div v-if="applyResult" class="apply-result-head">
              <span>生成结果</span>
              <el-button size="small" text @click="copyResult">复制</el-button>
            </div>
            <div v-if="applyResult" class="md-preview" v-html="renderedResult"></div>
            <div v-if="applying && !applyResult" class="typing-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { Box, QuestionFilled, Document, Calendar, EditPen, Grid, Plus, Edit, Delete, Check, MagicStick, CopyDocument, Star } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ArticleStatus, Skill } from '@/types'
import { geoApi } from '@/api/client'
import { callAIStream } from '@/api/ai'
import { markdownToHtml } from '@/utils/markdown'

const router = useRouter()
const data = useDataStore()

const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

const coverageText = computed(() => {
  const s = data.coverage.summary
  return `共 ${s.total_q} 个问题，已覆盖 ${s.covered_q} 个（${Math.round(s.rate * 100)}%）`
})

const topQuestions = computed(() =>
  data.geo_questions.filter(q => q.priority === 'high' && q.status === 'active').slice(0, 5)
)

const recentArticles = computed(() =>
  [...data.articles].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 5)
)

function statusLabel(status: ArticleStatus) {
  return { draft: '草稿', review: '待审核', approved: '已确认', archived: '归档' }[status] || status
}

function statusTagType(status: ArticleStatus): any {
  return { draft: 'info', review: 'warning', approved: 'success', archived: 'info' }[status] || 'info'
}

// ===== Skills =====
const CAT_COLORS: Record<string, string> = {
  '创意': '#f59e0b',
  '分析': '#6366f1',
  '内容': '#10b981',
  '商业': '#ef4444',
  '运营': '#8b5cf6',
}

function catColor(cat: string): string {
  return CAT_COLORS[cat] || '#64748b'
}

const drawerVisible = ref(false)
const currentSkill = ref<Skill | null>(null)
const editing = ref(false)
const saving = ref(false)
const editContent = ref('')
const applying = ref(false)
const showApplyInput = ref(false)
const applyInput = ref('')
const applyResult = ref('')
const applyThinking = ref('')
const applyThinkingDone = ref(false)

const renderedContent = computed(() => currentSkill.value ? markdownToHtml(currentSkill.value.content || '') : '')
const renderedResult = computed(() => applyResult.value ? markdownToHtml(applyResult.value) : '')

function openSkill(skill: Skill) {
  currentSkill.value = { ...skill }
  editing.value = false
  showApplyInput.value = false
  applyResult.value = ''
  applyInput.value = ''
  drawerVisible.value = true
}

function startEdit() {
  if (!currentSkill.value) return
  editContent.value = currentSkill.value.content
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  editContent.value = ''
}

async function saveSkill() {
  if (!currentSkill.value) return
  saving.value = true
  try {
    const updated = await geoApi(`/api/skills/${currentSkill.value.id}`, {
      method: 'PATCH',
      body: { content: editContent.value },
    })
    Object.assign(currentSkill.value, updated)
    const idx = data.skills.findIndex(s => s.id === currentSkill.value!.id)
    if (idx >= 0) data.skills[idx] = updated
    editing.value = false
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteSkill() {
  if (!currentSkill.value) return
  try {
    await ElMessageBox.confirm(`确定删除「${currentSkill.value.name}」吗？`, '确认删除', { type: 'warning' })
    await geoApi(`/api/skills/${currentSkill.value.id}`, { method: 'DELETE' })
    data.skills = data.skills.filter(s => s.id !== currentSkill.value!.id)
    drawerVisible.value = false
    ElMessage.success('已删除')
  } catch { /* 取消 */ }
}

async function cloneSkill() {
  if (!currentSkill.value) return
  try {
    const newSkill = await geoApi('/api/skills', {
      method: 'POST',
      body: {
        name: currentSkill.value.name + '（副本）',
        description: currentSkill.value.description,
        category: currentSkill.value.category,
        content: currentSkill.value.content,
        is_preset: false,
      },
    })
    data.skills.push(newSkill)
    currentSkill.value = newSkill
    ElMessage.success('已克隆，现在可以自由编辑')
  } catch (e: any) {
    ElMessage.error(e.message || '克隆失败')
  }
}

async function createSkill() {
  const name = prompt('Skill 名称：')
  if (!name) return
  try {
    const newSkill = await geoApi('/api/skills', {
      method: 'POST',
      body: { name, description: '', category: '自定义', content: '# ' + name + '\n\n在这里编写你的 Skill 内容...', is_preset: false },
    })
    data.skills.push(newSkill)
    openSkill(newSkill)
  } catch (e: any) {
    ElMessage.error(e.message || '创建失败')
  }
}

function applySkill() {
  showApplyInput.value = true
  if (!applyInput.value) {
    applyInput.value = `请基于以下 Skill 知识，帮我完成任务。\n\nSkill：${currentSkill.value?.name}`
  }
}

async function runApply() {
  if (!currentSkill.value || !applyInput.value.trim()) return
  applying.value = true
  applyResult.value = ''
  applyThinking.value = ''
  applyThinkingDone.value = false
  try {
    const prompt = `你需要参考以下 Skill 知识来帮助用户：

---
${currentSkill.value.content}
---

用户的需求：
${applyInput.value}

请严格参考上面的 Skill 方法论和框架，给出完整、实用的回复。`
    await callAIStream(data.ai_settings, [{ role: 'user', content: prompt }], {
      onThinking: (t) => { applyThinking.value = t },
      onContent: (t) => { applyResult.value = t },
      onDone: () => { applyThinkingDone.value = true },
      onError: (e) => { applyResult.value = '生成失败：' + (e.message || e) },
    })
  } catch (e: any) {
    // 已在 onError 处理
  } finally {
    applying.value = false
  }
}

function copyResult() {
  navigator.clipboard.writeText(applyResult.value).then(() => {
    ElMessage.success('已复制到剪贴板')
  })
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  animation: fadeSlideIn 0.4s ease-out;
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 精致 hero */
.hero {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #8b5cf6 100%);
  color: white;
  padding: 24px 28px;
  border-radius: var(--geo-radius-xl);
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 24px -6px rgba(99, 102, 241, 0.35);
}

.hero::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  pointer-events: none;
}

.hero::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-left {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.hero-eyebrow {
  font-size: 12px;
  opacity: 0.92;
  display: inline-flex;
  align-items: center;
  font-weight: 500;
}

.hero-date {
  font-size: 12px;
  opacity: 0.85;
  white-space: nowrap;
  position: relative;
  z-index: 1;
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(8px);
  padding: 4px 10px;
  border-radius: 20px;
}

.hero h2 {
  margin: 10px 0 6px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.hero-desc {
  margin: 0;
  opacity: 0.9;
  line-height: 1.6;
  font-size: 13px;
  max-width: 500px;
}

.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: #34d399;
  border-radius: 50%;
  margin-right: 7px;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.15); }
}

/* 统计卡片 */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--el-bg-color);
  border: 1px solid var(--geo-border);
  border-radius: var(--geo-radius-lg);
  cursor: pointer;
  transition: all var(--geo-transition-slow);
  position: relative;
  overflow: hidden;
}

.stat-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  opacity: 0;
  transition: opacity var(--geo-transition);
}

.stat-card:hover {
  box-shadow: var(--geo-shadow-md);
  transform: translateY(-3px);
  border-color: var(--geo-brand-light);
}

.stat-card:hover::after {
  opacity: 1;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  transition: transform var(--geo-transition-slow);
}

.stat-card:hover .stat-icon {
  transform: scale(1.08);
}

.stat-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-body small {
  font-size: 12px;
  color: var(--geo-text-muted);
  font-weight: 500;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* 各卡片配色 */
.stat-products .stat-icon { background: #eef2ff; color: #4f46e5; }
.stat-products::after { background: linear-gradient(90deg, #6366f1, #818cf8); }
.stat-questions .stat-icon { background: #fef3c7; color: #d97706; }
.stat-questions::after { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.stat-articles .stat-icon { background: #d1fae5; color: #059669; }
.stat-articles::after { background: linear-gradient(90deg, #10b981, #34d399); }
.stat-tasks .stat-icon { background: #fce7f3; color: #db2777; }
.stat-tasks::after { background: linear-gradient(90deg, #ec4899, #f472b6); }

/* 快捷操作 */
.quick-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.quick-actions .el-button {
  font-size: 13px;
  height: 34px;
}

.quick-actions .el-button .el-icon {
  margin-right: 5px;
}

/* 区块卡片 */
.section-card {
  border-radius: var(--geo-radius-lg) !important;
  margin-bottom: 18px !important;
  transition: all var(--geo-transition-slow) !important;
}

.section-card:hover {
  box-shadow: var(--geo-shadow-md) !important;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
}

.coverage-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
}

.coverage-name {
  width: 120px;
  flex-shrink: 0;
  font-weight: 500;
  font-size: 13px;
}

.compact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  cursor: pointer;
  border-bottom: 1px solid var(--geo-border-light);
}

.compact-item:hover {
  background: var(--el-fill-color-light);
  margin: 0 -12px;
  padding: 8px 12px;
}

.compact-item:last-child {
  border-bottom: none;
}

.compact-text {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted {
  color: var(--geo-text-muted);
  font-size: 12px;
}

/* Skills */
.skills-card { margin-bottom: 16px; }
.skills-empty { padding: 20px 0; }
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.skill-card {
  border: 1px solid var(--geo-border);
  border-radius: var(--geo-radius-lg);
  padding: 16px;
  cursor: pointer;
  transition: all var(--geo-transition-slow);
  background: var(--el-bg-color);
  position: relative;
  overflow: hidden;
}
.skill-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--skill-color, var(--geo-brand));
  opacity: 0;
  transition: opacity var(--geo-transition);
}
.skill-card:hover {
  border-color: var(--geo-brand-light);
  box-shadow: var(--geo-shadow-md);
  transform: translateY(-3px);
}
.skill-card:hover::before {
  opacity: 1;
}
.skill-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.skill-cat {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  color: white;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.skill-name {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  transition: color var(--geo-transition);
}
.skill-card:hover .skill-name {
  color: var(--geo-brand);
}
.skill-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Skill 抽屉 */
.drawer-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.drawer-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}
.skill-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.skill-desc-full {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}
.skill-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--geo-radius);
  margin-bottom: 12px;
}
.skill-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.apply-section {
  margin-top: 16px;
}
.apply-actions {
  margin: 10px 0;
  display: flex;
  gap: 8px;
}
.apply-result {
  margin-top: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--geo-radius);
  padding: 12px;
  background: var(--el-bg-color);
}
.apply-result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

/* 思考过程 */
.apply-thinking {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #fef3c7, #fef9c3);
  border-radius: 8px;
  border: 1px solid #fde68a;
}
.thinking-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #92400e;
  margin-bottom: 6px;
}
.thinking-content {
  font-size: 12px;
  color: #78350f;
  opacity: 0.85;
  line-height: 1.6;
  max-height: 150px;
  overflow-y: auto;
}
.typing-dots {
  display: inline-flex;
  gap: 5px;
  padding: 10px 4px;
}
.typing-dots span {
  width: 7px;
  height: 7px;
  background: var(--el-color-primary);
  border-radius: 50%;
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing-dots span:nth-child(2) { animation-delay: 0.15s; }
.typing-dots span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* Markdown 预览 */
.md-preview {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
}
.md-preview h1 { font-size: 20px; margin: 16px 0 8px; font-weight: 600; }
.md-preview h2 { font-size: 17px; margin: 14px 0 6px; font-weight: 600; }
.md-preview h3 { font-size: 15px; margin: 12px 0 4px; font-weight: 600; }
.md-preview p { margin: 8px 0; }
.md-preview ul, .md-preview ol { padding-left: 20px; margin: 8px 0; }
.md-preview li { margin: 4px 0; }
.md-preview code {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  font-family: monospace;
}
.md-preview pre {
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}
.md-preview pre code { background: transparent; padding: 0; }
.md-preview blockquote {
  border-left: 3px solid var(--el-color-primary);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--el-text-color-secondary);
}
.md-preview table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}
.md-preview th, .md-preview td {
  border: 1px solid var(--el-border-color-lighter);
  padding: 6px 10px;
  text-align: left;
  font-size: 13px;
}
.md-preview th { background: var(--el-fill-color-light); font-weight: 600; }
.md-preview strong { font-weight: 600; }
</style>
