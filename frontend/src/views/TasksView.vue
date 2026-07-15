<template>
  <div class="tasks-view">
    <!-- 顶部统计栏 -->
    <section class="tasks-header">
      <el-row :gutter="12" class="stats-row">
        <el-col :span="6" v-for="c in statsCards" :key="c.label">
          <div :class="['stat-card', `tone-${c.tone}`]">
            <div class="stat-value">{{ c.value }}</div>
            <div class="stat-label">{{ c.label }}</div>
            <div class="stat-hint">{{ c.hint }}</div>
          </div>
        </el-col>
      </el-row>
      <div class="filters-row">
        <el-input v-model="searchQuery" placeholder="搜索任务（标题/平台/账号/标签）…" clearable size="default" class="search-input" />
        <el-select v-model="filterProduct" placeholder="全部产品" clearable size="default" class="filter-select">
          <el-option v-for="p in data.products" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <el-select v-model="filterPlatform" placeholder="全部平台" clearable size="default" class="filter-select">
          <el-option v-for="p in data.platforms" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
      </div>
    </section>

    <el-tabs v-model="activeTab" @tab-change="onTabChange" class="tasks-tabs">
      <!-- 热力图 -->
      <el-tab-pane label="📊 热力图" name="heatmap">
        <div class="heatmap-block">
          <div class="heatmap-head">
            <h4>发布热力图</h4>
            <div class="heatmap-legend">
              <span class="legend-label">少</span>
              <span class="legend-swatch" v-for="i in 5" :key="i" :style="{ background: heatColorScale[i-1] }"></span>
              <span class="legend-label">多</span>
            </div>
          </div>
          <div v-if="data.products.length === 0 || data.platforms.length === 0" class="heatmap-empty">
            <el-empty description="先添加产品和平台，再来查看热力图" :image-size="60" />
          </div>
          <div v-else class="heatmap-table-wrap">
            <table class="heatmap-table">
              <thead>
                <tr>
                  <th class="heatmap-corner">平台 \ 产品</th>
                  <th v-for="p in data.products" :key="p.id" class="heatmap-col-header">
                    <span class="col-name">{{ p.name }}</span>
                  </th>
                  <th class="heatmap-total-col">合计</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="plat in data.platforms" :key="plat.id">
                  <td class="heatmap-row-header">{{ plat.name }}</td>
                  <td
                    v-for="prod in data.products"
                    :key="prod.id"
                    class="heatmap-cell"
                    :style="{ background: cellColor(plat.id, prod.id) }"
                    :class="{ 'cell-zero': cellCount(plat.id, prod.id) === 0 }"
                  >
                    <span class="cell-num">{{ cellCount(plat.id, prod.id) }}</span>
                  </td>
                  <td class="heatmap-total-cell">
                    <strong>{{ rowTotal(plat.id) }}</strong>
                  </td>
                </tr>
                <tr class="heatmap-total-row">
                  <td class="heatmap-row-header"><strong>合计</strong></td>
                  <td v-for="prod in data.products" :key="prod.id" class="heatmap-total-cell">
                    <strong>{{ colTotal(prod.id) }}</strong>
                  </td>
                  <td class="heatmap-grand-total">
                    <strong>{{ grandTotal }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </el-tab-pane>

      <!-- 发布日历 -->
      <el-tab-pane label="📅 发布日历" name="calendar">
        <div class="calendar">
          <div class="calendar-header">
            <el-button @click="prevMonth" size="small">‹ 上月</el-button>
            <h3>{{ calendarYear }}年 {{ calendarMonth + 1 }}月</h3>
            <el-button @click="nextMonth" size="small">下月 ›</el-button>
          </div>
          <div class="calendar-grid">
            <div v-for="w in weekdays" :key="w" class="calendar-weekday">{{ w }}</div>
            <div v-for="n in calendarPadding" :key="'p' + n" class="calendar-day empty"></div>
            <div
              v-for="day in calendarDays"
              :key="day"
              :class="['calendar-day', { today: isToday(day) }]"
            >
              <div class="calendar-day-number">{{ day }}<span v-if="isToday(day)"> · 今天</span></div>
              <div
                v-for="t in tasksOnDay(day).slice(0, 4)"
                :key="t.id"
                :class="['calendar-task', t.status]"
                :title="t.platform_name"
                @click="jumpToBoard(t.id)"
              >{{ t.article_title }}</div>
              <div v-if="tasksOnDay(day).length > 4" class="calendar-more">+{{ tasksOnDay(day).length - 4 }}</div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 看板视图 -->
      <el-tab-pane label="📋 看板视图" name="board">
        <div class="task-board">
          <div
            v-for="col in boardColumns"
            :key="col.status"
            class="task-column"
            :data-status="col.status"
            @dragover.prevent="onDragOver($event, col.status)"
            @dragleave="onDragLeave($event)"
            @drop="onDrop($event, col.status)"
          >
            <h3>
              <span :class="['col-dot', col.status]"></span>
              {{ col.label }}
              <el-badge :value="boardTasks(col.status).length" type="info" />
            </h3>
            <article
              v-for="task in boardTasks(col.status)"
              :key="task.id"
              class="task-card"
              :class="{ published: task.status === 'published' && task.publish_url }"
              draggable="true"
              :data-task-id="task.id"
              @dragstart="onDragStart($event, task.id)"
              @dragend="onDragEnd($event)"
            >
              <h4>{{ task.article_title || '无标题' }}</h4>
              <p v-if="taskMeta(task)" class="muted">{{ taskMeta(task) }}</p>
              <p v-if="task.platform_login_notes" class="hint">📝 {{ task.platform_login_notes }}</p>
              <p v-if="task.status === 'todo' && bestTime(task.platform_name)" class="hint best-time">
                ⏰ 最佳发布：{{ bestTime(task.platform_name)!.weekday }} {{ bestTime(task.platform_name)!.time }}
              </p>
              <p v-if="task.article_risk_notes" class="muted">⚠️ {{ task.article_risk_notes }}</p>
              <div class="task-actions">
                <el-input
                  v-model="urlCache[task.id]"
                  size="small"
                  placeholder="粘贴已发布链接…"
                />
                <div class="action-row">
                  <el-button size="small" @click="openPlatform(task.platform_url)">打开</el-button>
                  <el-dropdown trigger="click" @command="(cmd: string) => copyTask(task, cmd)">
                    <el-button size="small">复制 ▾</el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="title">复制标题</el-dropdown-item>
                        <el-dropdown-item command="body">复制正文</el-dropdown-item>
                        <el-dropdown-item command="all">复制整包</el-dropdown-item>
                        <el-dropdown-item v-if="task.publish_url" command="share">📤 分享链接</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
                <div class="action-row">
                  <el-button size="small" :type="task.status === 'published' ? 'default' : 'primary'" @click="setStatus(task, 'published')">已发布</el-button>
                  <el-button size="small" @click="setStatus(task, 'revise')">需修改</el-button>
                  <el-button size="small" @click="setStatus(task, 'skipped')">跳过</el-button>
                  <el-button size="small" type="danger" plain @click="removeTask(task)">删除</el-button>
                </div>
              </div>
            </article>
            <el-empty v-if="boardTasks(col.status).length === 0" :image-size="40" :description="filteredTasks.length ? '空' : '没有匹配的任务'" />
          </div>
        </div>
      </el-tab-pane>

      <!-- 发布页面 -->
      <el-tab-pane label="✍️ 发布页面" name="publish">
        <el-row :gutter="20">
          <el-col :span="14">
            <el-card shadow="never">
              <template #header><h4>新建发布记录</h4></template>
              <el-form label-position="top" :model="taskForm">
                <el-form-item label="选择产品" required>
                  <el-select v-model="taskForm.productId" placeholder="请选择产品…" @change="onFormProductChange">
                    <el-option v-for="p in data.products" :key="p.id" :label="p.name" :value="p.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="选择内容" required>
                  <el-select v-model="taskForm.articleId" placeholder="请选择内容…" :disabled="!taskForm.productId">
                    <el-option v-for="a in formArticles" :key="a.id" :label="a.title || '未命名'" :value="a.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="选择平台" required>
                  <el-select v-model="taskForm.platformId" placeholder="请选择平台…" @change="onFormPlatformChange">
                    <el-option v-for="p in data.platforms" :key="p.id" :label="p.name" :value="p.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="发布链接">
                  <el-input v-model="taskForm.url" placeholder="已发布链接（选平台后自动填充）">
                    <template #append>
                      <el-button @click="openPlatform(formPlatformUrl)">打开平台</el-button>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item label="状态">
                  <el-select v-model="taskForm.status">
                    <el-option label="待发布" value="todo" />
                    <el-option label="已发布" value="published" />
                    <el-option label="需修改" value="revise" />
                    <el-option label="已跳过" value="skipped" />
                  </el-select>
                </el-form-item>
                <el-form-item label="备注">
                  <el-input v-model="taskForm.notes" type="textarea" :rows="2" />
                </el-form-item>
                <div class="form-actions">
                  <el-button type="primary" @click="saveTask" :loading="saving">保存</el-button>
                  <el-button @click="resetForm">重置</el-button>
                </div>
              </el-form>
            </el-card>
          </el-col>
          <el-col :span="10">
            <el-card shadow="never">
              <template #header><h4>批量分配任务</h4></template>
              <p class="muted small">选择文章和平台，一键创建发布任务（已存在的自动跳过）</p>
              <el-form label-position="top">
                <el-form-item label="选择文章（多选）">
                  <el-select v-model="batchArticles" multiple filterable placeholder="选择文章…">
                    <el-option v-for="a in data.articles" :key="a.id" :label="a.title || '未命名'" :value="a.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="选择平台（多选）">
                  <el-select v-model="batchPlatforms" multiple filterable placeholder="选择平台…">
                    <el-option v-for="p in data.platforms" :key="p.id" :label="p.name" :value="p.id" />
                  </el-select>
                </el-form-item>
                <el-button type="primary" @click="assignTasks" :loading="assigning">批量分配</el-button>
              </el-form>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useToast } from '@/composables/useToast'
import { geoApi } from '@/api/client'
import { copyToClipboard, formatLocalNow } from '@/utils/helpers'
import { getPlatformBestPublishTime } from '@/utils/ai-prompts'
import type { PublishTask } from '@/types'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const { toast, success, warning, error, confirm } = useToast()

// ===== Tab 与路由同步 =====
const _tabParam = route.params.tab
const activeTab = ref<string>((Array.isArray(_tabParam) ? _tabParam[0] : _tabParam) || 'calendar')

function onTabChange(tab: string) {
  router.replace(`/tasks/${tab}`)
}

watch(() => route.params.tab, (tab) => {
  const t = Array.isArray(tab) ? tab[0] : tab
  if (t && t !== activeTab.value) activeTab.value = t
})

// ===== 搜索与筛选 =====
const searchQuery = ref('')
const filterProduct = ref('')
const filterPlatform = ref('')

const filteredTasks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return data.tasks.filter(task => {
    const text = [task.article_title, task.platform_name, task.platform_account_name, task.article_tags]
      .filter(Boolean).join(' ').toLowerCase()
    if (q && !text.includes(q)) return false
    if (filterProduct.value && String(task.product_id || '') !== String(filterProduct.value)) return false
    if (filterPlatform.value && String(task.platform_id || '') !== String(filterPlatform.value)) return false
    return true
  })
})

// ===== 统计卡片 =====
const statsCards = computed(() => {
  const tasks = data.tasks
  const total = tasks.length
  const published = tasks.filter(t => t.status === 'published').length
  const todo = tasks.filter(t => t.status === 'todo').length
  const revise = tasks.filter(t => t.status === 'revise').length
  const publishedRate = total ? Math.round((published / total) * 100) : 0
  const platformsWithPublish = new Set(
    tasks.filter(t => t.status === 'published' && t.platform_id).map(t => t.platform_id)
  )
  const totalPlatforms = data.platforms.filter(p => p.status === 'enabled').length
  const platformCov = totalPlatforms ? Math.round((platformsWithPublish.size / totalPlatforms) * 100) : 0
  return [
    { label: '发布任务', value: total, hint: '总记录数', tone: 'neutral' },
    { label: '已发布', value: published, hint: `占比 ${publishedRate}%`, tone: 'good' },
    { label: '待发布', value: todo, hint: revise ? `需修改 ${revise}` : '等待执行', tone: 'warn' },
    { label: '平台覆盖', value: `${platformsWithPublish.size}/${totalPlatforms}`, hint: `覆盖率 ${platformCov}%`, tone: 'accent' },
  ]
})

// ===== 热力图 =====
const heatColorScale = ['#f5f7fa', '#e0eaff', '#b3c5ff', '#6b82ff', '#4f46e5']

function _filteredCount(platId: string, prodId: string): number {
  return data.tasks.filter(t =>
    String(t.platform_id || '') === String(platId) &&
    String(t.product_id || '') === String(prodId) &&
    (!searchQuery.value.trim() || [t.article_title, t.platform_name, t.platform_account_name, t.article_tags]
      .filter(Boolean).join(' ').toLowerCase().includes(searchQuery.value.trim().toLowerCase()))
  ).length
}

const heatMaxCount = computed(() => {
  let max = 0
  for (const plat of data.platforms) {
    for (const prod of data.products) {
      const c = _filteredCount(plat.id, prod.id)
      if (c > max) max = c
    }
  }
  return max
})

function cellCount(platId: string, prodId: string): number {
  return _filteredCount(platId, prodId)
}

function cellColor(platId: string, prodId: string): string {
  const count = _filteredCount(platId, prodId)
  if (count === 0) return '#fafafa'
  const max = heatMaxCount.value || 1
  const ratio = Math.min(count / max, 1)
  if (ratio <= 0.25) return heatColorScale[1]
  if (ratio <= 0.5) return heatColorScale[2]
  if (ratio <= 0.75) return heatColorScale[3]
  return heatColorScale[4]
}

function rowTotal(platId: string): number {
  let sum = 0
  for (const prod of data.products) {
    sum += _filteredCount(platId, prod.id)
  }
  return sum
}

function colTotal(prodId: string): number {
  let sum = 0
  for (const plat of data.platforms) {
    sum += _filteredCount(plat.id, prodId)
  }
  return sum
}

const grandTotal = computed(() => {
  return data.tasks.filter(t =>
    t.platform_id && t.product_id &&
    (!searchQuery.value.trim() || [t.article_title, t.platform_name, t.platform_account_name, t.article_tags]
      .filter(Boolean).join(' ').toLowerCase().includes(searchQuery.value.trim().toLowerCase()))
  ).length
})

// ===== 日历 =====
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const calendarDate = ref(new Date())

const calendarYear = computed(() => calendarDate.value.getFullYear())
const calendarMonth = computed(() => calendarDate.value.getMonth())
const calendarPadding = computed(() => new Date(calendarYear.value, calendarMonth.value, 1).getDay())
const calendarDays = computed(() => new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate())

function isToday(day: number) {
  const now = new Date()
  return now.getFullYear() === calendarYear.value &&
    now.getMonth() === calendarMonth.value &&
    now.getDate() === day
}

function prevMonth() {
  calendarDate.value = new Date(calendarYear.value, calendarMonth.value - 1, 1)
}

function nextMonth() {
  calendarDate.value = new Date(calendarYear.value, calendarMonth.value + 1, 1)
}

function tasksOnDay(day: number) {
  const key = `${calendarYear.value}-${calendarMonth.value}-${day}`
  return filteredTasks.value.filter(task => {
    const dateStr = task.status === 'published' ? (task as any).published_at : task.created_at
    if (!dateStr) return false
    const d = new Date(String(dateStr).replace(/-/g, '/'))
    if (isNaN(d.getTime())) return false
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === key
  })
}

function jumpToBoard(taskId: string) {
  activeTab.value = 'board'
  router.replace('/tasks/board')
  // 滚动到对应任务（简单实现：稍后滚动）
  setTimeout(() => {
    const el = document.querySelector(`[data-task-id="${taskId}"]`) || document.querySelector(`.task-card`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 100)
}

// ===== 看板 =====
const boardColumns = [
  { status: 'todo', label: '待发布' },
  { status: 'published', label: '已发布' },
  { status: 'revise', label: '需修改' },
  { status: 'skipped', label: '已跳过' },
] as const

function boardTasks(status: string) {
  return filteredTasks.value.filter(t => t.status === status)
}

function taskMeta(task: PublishTask) {
  return [task.platform_name, task.platform_category, task.platform_account_name ? `账号：${task.platform_account_name}` : '']
    .filter(Boolean).join(' · ')
}

function bestTime(platformName?: string) {
  if (!platformName) return null
  return getPlatformBestPublishTime(platformName)
}

// URL 输入缓存（避免每次 keystroke 触发响应式更新）
const urlCache = reactive<Record<string, string>>({})
onMounted(() => {
  // 初始化已有任务的 URL 缓存
  data.tasks.forEach(t => { urlCache[t.id] = t.publish_url || '' })
})
watch(() => data.tasks, () => {
  data.tasks.forEach(t => {
    if (!(t.id in urlCache)) urlCache[t.id] = t.publish_url || ''
  })
}, { deep: false })

// ===== 拖拽 =====
let dragTaskId = ''

function onDragStart(e: DragEvent, taskId: string) {
  dragTaskId = taskId
  e.dataTransfer?.setData('text/plain', taskId)
  ;(e.target as HTMLElement).classList.add('dragging')
}

function onDragEnd(e: DragEvent) {
  ;(e.target as HTMLElement).classList.remove('dragging')
  document.querySelectorAll('.task-column.drag-over').forEach(el => el.classList.remove('drag-over'))
}

function onDragOver(e: DragEvent, _status: string) {
  ;(e.currentTarget as HTMLElement).classList.add('drag-over')
}

function onDragLeave(e: DragEvent) {
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
}

async function onDrop(e: DragEvent, newStatus: string) {
  ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
  const id = dragTaskId || e.dataTransfer?.getData('text/plain') || ''
  dragTaskId = ''
  if (!id) return
  const task = data.tasks.find(t => t.id === id)
  if (!task || task.status === newStatus) return
  await setStatus(task, newStatus as PublishTask['status'])
}

// ===== 任务操作 =====
async function setStatus(task: PublishTask, newStatus: PublishTask['status']) {
  const wasPublished = task.status === 'published'
  const body: any = { status: newStatus }
  const url = urlCache[task.id]
  if (url !== undefined) body.publish_url = url
  const isNewPublish = newStatus === 'published' && !wasPublished
  if (newStatus === 'published' && !body.published_at) body.published_at = formatLocalNow()
  try {
    await geoApi(`/api/tasks/${task.id}`, { method: 'PATCH', body })
    if (isNewPublish) {
      success('🎉 发布成功！内容已记录，别忘了分享哦～')
    } else if (newStatus === 'revise') {
      warning('已标记为需修改')
    } else if (newStatus === 'skipped') {
      toast('已跳过该任务', 'info')
    } else {
      success('状态已更新')
    }
    await data.load()
  } catch (e: any) {
    error('操作失败：' + (e?.message || ''))
  }
}

async function removeTask(task: PublishTask) {
  const ok = await confirm('确定删除该任务？此操作不可恢复。', '删除任务')
  if (!ok) return
  try {
    await geoApi(`/api/tasks/${task.id}`, { method: 'DELETE' })
    success('任务已删除')
    await data.load()
  } catch (e: any) {
    error('删除失败：' + (e?.message || ''))
  }
}

function openPlatform(url?: string) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
  else error('该平台未配置发布入口链接')
}

// ===== 复制 =====
function taskCopyText(task: PublishTask, kind: string): string {
  if (kind === 'title') return task.article_title || ''
  if (kind === 'body') return task.article_body || ''
  if (kind === 'share') {
    const parts = [`📝 ${task.article_title || ''}`]
    if (task.publish_url) parts.push(`🔗 ${task.publish_url}`)
    parts.push('\n—— 来自 GEO Studio')
    return parts.join('\n')
  }
  return [
    `标题：${task.article_title || ''}`,
    '',
    task.article_summary ? `摘要：${task.article_summary}` : '',
    '',
    task.article_body || '',
    '',
    task.article_tags ? `标签：${task.article_tags}` : '',
    task.article_keywords ? `关键词：${task.article_keywords}` : '',
    task.article_image_prompt ? `配图建议：${task.article_image_prompt}` : '',
  ].filter(Boolean).join('\n')
}

async function copyTask(task: PublishTask, kind: string) {
  const text = taskCopyText(task, kind)
  const ok = await copyToClipboard(text)
  if (ok) {
    if (kind === 'share') success('分享链接已复制！快去分享吧 ✨')
    else success('发布素材已复制')
  } else {
    error('复制失败')
  }
}

// ===== 发布表单 =====
const taskForm = reactive({
  productId: '',
  articleId: '',
  platformId: '',
  url: '',
  status: 'todo' as PublishTask['status'],
  notes: '',
})
const saving = ref(false)

const formArticles = computed(() => {
  if (!taskForm.productId) return data.articles
  return data.articles.filter(a => String(a.product_id) === String(taskForm.productId))
})

const formPlatformUrl = computed(() => {
  if (!taskForm.platformId) return ''
  return data.platforms.find(p => p.id === taskForm.platformId)?.url || ''
})

function onFormProductChange() {
  taskForm.articleId = ''
}

function onFormPlatformChange() {
  if (!taskForm.url.trim()) {
    taskForm.url = formPlatformUrl.value
  }
}

function resetForm() {
  taskForm.productId = ''
  taskForm.articleId = ''
  taskForm.platformId = ''
  taskForm.url = ''
  taskForm.status = 'todo'
  taskForm.notes = ''
}

async function saveTask() {
  if (!taskForm.articleId) return error('请选择发布内容')
  if (!taskForm.platformId) return error('请选择发布平台')
  const payload: any = {
    article_id: String(taskForm.articleId),
    platform_id: String(taskForm.platformId),
    status: taskForm.status,
    publish_url: taskForm.url.trim(),
    notes: taskForm.notes.trim(),
  }
  if (taskForm.status === 'published') payload.published_at = formatLocalNow()
  saving.value = true
  try {
    await geoApi('/api/tasks', { method: 'POST', body: payload })
    success('发布记录已保存')
    resetForm()
    await data.load()
  } catch (e: any) {
    error('保存失败：' + (e?.message || ''))
  } finally {
    saving.value = false
  }
}

// ===== 批量分配 =====
const batchArticles = ref<string[]>([])
const batchPlatforms = ref<string[]>([])
const assigning = ref(false)

async function assignTasks() {
  if (!batchArticles.value.length || !batchPlatforms.value.length) {
    return error('请选择文章和平台')
  }
  assigning.value = true
  try {
    const result = await geoApi('/api/tasks/assign', {
      method: 'POST',
      body: { article_ids: batchArticles.value, platform_ids: batchPlatforms.value },
    })
    const msg = result.skipped?.length > 0
      ? `新增 ${result.created.length} 个任务（跳过 ${result.skipped.length} 个已存在）`
      : `新增 ${result.created.length} 个发布任务`
    success(msg)
    batchArticles.value = []
    batchPlatforms.value = []
    await data.load()
  } catch (e: any) {
    error('分配失败：' + (e?.message || ''))
  } finally {
    assigning.value = false
  }
}
</script>

<style scoped>
.tasks-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 统计栏 */
.tasks-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-row {
  margin: 0 !important;
}

.stat-card {
  padding: 14px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border-left: 3px solid var(--el-border-color);
}

.stat-card.tone-good { border-left-color: var(--el-color-success); }
.stat-card.tone-warn { border-left-color: var(--el-color-warning); }
.stat-card.tone-accent { border-left-color: var(--el-color-primary); }
.stat-card.tone-neutral { border-left-color: var(--el-color-info); }

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-primary);
  margin-top: 2px;
}

.stat-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.filters-row {
  display: flex;
  gap: 8px;
}

.search-input {
  flex: 1;
}

.filter-select {
  width: 160px;
}

/* 看板热力图 */
.heatmap-block {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--geo-radius-lg);
  padding: 14px 18px;
}
.heatmap-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.heatmap-head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  padding-left: 10px;
  border-left: 3px solid var(--el-color-primary);
}
.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
}
.legend-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin: 0 4px;
}
.legend-swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  display: inline-block;
}
.heatmap-empty {
  padding: 20px 0;
}
.heatmap-table-wrap {
  overflow-x: auto;
}
.heatmap-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  min-width: 500px;
}
.heatmap-table th,
.heatmap-table td {
  padding: 0;
  text-align: center;
  border: 1px solid var(--el-border-color-lighter);
}
.heatmap-corner {
  background: var(--el-fill-color-light);
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  padding: 8px 12px !important;
  white-space: nowrap;
  width: 100px;
  min-width: 100px;
}
.heatmap-col-header {
  background: var(--el-fill-color-light);
  padding: 6px 4px !important;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  min-width: 90px;
}
.col-name {
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.heatmap-row-header {
  background: var(--el-fill-color-light);
  padding: 6px 12px !important;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  text-align: left !important;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.heatmap-cell {
  padding: 8px 4px !important;
  cursor: default;
  transition: transform 0.15s;
}
.heatmap-cell:hover {
  transform: scale(1.08);
  z-index: 1;
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.heatmap-cell.cell-zero { color: var(--el-text-color-disabled); }
.cell-num {
  font-size: 13px;
  font-weight: 600;
  display: inline-block;
  min-width: 20px;
}
.heatmap-total-col {
  background: var(--el-fill-color-light);
  font-weight: 600;
  min-width: 60px;
}
.heatmap-total-cell {
  background: var(--el-color-primary-light-9);
  padding: 8px 4px !important;
  font-size: 13px;
}
.heatmap-total-row .heatmap-row-header,
.heatmap-total-row .heatmap-total-cell {
  background: var(--el-color-primary-light-8);
}
.heatmap-grand-total {
  background: var(--el-color-primary-light-7);
  padding: 8px 4px !important;
  font-size: 14px;
  color: var(--el-color-primary-dark-2);
}

/* Tabs */
.tasks-tabs {
  flex: 1;
}

/* 日历 */
.calendar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.calendar-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 6px 0;
}

.calendar-day {
  min-height: 90px;
  padding: 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.calendar-day.empty {
  background: transparent;
  border: none;
}

.calendar-day.today {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.calendar-day-number {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.calendar-task {
  font-size: 11px;
  padding: 3px 6px;
  margin-bottom: 3px;
  border-radius: 3px;
  background: var(--el-fill-color);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-left: 2px solid var(--el-border-color);
}

.calendar-task:hover {
  background: var(--el-fill-color-dark);
}

.calendar-task.published {
  border-left-color: var(--el-color-success);
}

.calendar-task.todo {
  border-left-color: var(--el-color-warning);
}

.calendar-task.revise {
  border-left-color: var(--el-color-danger);
}

.calendar-task.skipped {
  border-left-color: var(--el-text-color-disabled);
}

.calendar-more {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  padding: 2px 6px;
}

/* 看板 */
.task-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.task-column {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 12px;
  min-height: 300px;
  transition: background 0.2s;
}

.task-column.drag-over {
  background: var(--el-color-primary-light-9);
}

.task-column h3 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.col-dot.todo { background: var(--el-color-warning); }
.col-dot.published { background: var(--el-color-success); }
.col-dot.revise { background: var(--el-color-danger); }
.col-dot.skipped { background: var(--el-text-color-disabled); }

.task-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: grab;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.task-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.task-card.dragging {
  opacity: 0.5;
}

.task-card.published {
  border-left: 3px solid var(--el-color-success);
}

.task-card h4 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.task-card .muted {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin: 2px 0;
}

.task-card .hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin: 2px 0;
}

.task-card .hint.best-time {
  color: var(--el-color-warning);
}

.task-actions {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* 发布表单 */
.form-actions {
  display: flex;
  gap: 8px;
}

.muted {
  color: var(--el-text-color-secondary);
}

.small {
  font-size: 12px;
}

/* 响应式 */
@media (max-width: 1200px) {
  .task-board {
    grid-template-columns: repeat(2, 1fr);
  }
  .board-stats {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .task-board {
    grid-template-columns: 1fr;
  }
  .filters-row {
    flex-direction: column;
  }
  .filter-select {
    width: 100%;
  }
}
</style>
