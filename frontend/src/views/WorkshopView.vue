<template>
  <div class="split-layout">
    <div class="split-sidebar">
      <div class="sidebar-header">
        <h3>文章库</h3>
        <el-button type="primary" size="small" @click="startAdd">+ 新建</el-button>
      </div>
      <div class="sidebar-filters">
        <el-select v-model="filterProduct" placeholder="全部产品" clearable size="small">
          <el-option v-for="p in data.products" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="全部状态" clearable size="small">
          <el-option label="草稿" value="draft" />
          <el-option label="待审核" value="review" />
          <el-option label="已确认" value="approved" />
          <el-option label="归档" value="archived" />
        </el-select>
      </div>
      <el-input v-model="searchQuery" placeholder="搜索文章…" clearable size="small" class="sidebar-search" />
      <div class="sidebar-list">
        <div
          v-for="a in filteredArticles"
          :key="a.id"
          :class="['list-item', { active: a.id === selectedId }]"
          @click="selectArticle(a.id)"
        >
          <span class="item-name">{{ a.title || '无标题' }}</span>
          <el-tag size="small" :type="statusType(a.status)" effect="light">{{ statusLabel(a.status) }}</el-tag>
        </div>
        <el-empty v-if="filteredArticles.length === 0" :image-size="48" description="暂无文章" />
      </div>
      <div class="sidebar-footer muted">{{ filteredArticles.length }} 篇文章</div>
    </div>

    <div class="split-main">
      <!-- 提示词生成器（始终显示在顶部） -->
      <div class="prompt-generator section">
        <div class="section-header">
          <h3 class="section-title">
            <el-icon><MagicStick /></el-icon>
            提示词生成器
            <span class="section-subtitle">选择产品和平台，一键生成专业软文提示词，复制到豆包/WorkBuddy 等平台生成</span>
          </h3>
        </div>

        <div class="gen-grid">
          <div class="gen-field">
            <label>选择产品</label>
            <el-select v-model="genProduct" placeholder="请选择产品" size="small" filterable>
              <el-option v-for="p in data.products" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </div>
          <div class="gen-field">
            <label>发布平台</label>
            <el-select v-model="genPlatforms" multiple collapse-tags collapse-tags-tooltip placeholder="选择目标平台" size="small">
              <el-option v-for="p in data.platforms" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </div>
          <div class="gen-field full">
            <label>内容类型</label>
            <el-checkbox-group v-model="genTypes">
              <el-checkbox value="产品软文" size="small">产品软文</el-checkbox>
              <el-checkbox value="短视频脚本" size="small">短视频脚本</el-checkbox>
              <el-checkbox value="小红书笔记" size="small">小红书笔记</el-checkbox>
              <el-checkbox value="创意点子" size="small">创意点子</el-checkbox>
              <el-checkbox value="使用教程" size="small">使用教程</el-checkbox>
              <el-checkbox value="竞品对比" size="small">竞品对比</el-checkbox>
              <el-checkbox value="新闻稿" size="small">新闻稿</el-checkbox>
              <el-checkbox value="社媒文案" size="small">社媒文案</el-checkbox>
              <el-checkbox value="SEO长文" size="small">SEO/GEO 长文</el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="gen-field full">
            <label>补充说明（可选）</label>
            <el-input v-model="genNote" type="textarea" :rows="2" size="small" placeholder="比如：突出性价比、面向年轻用户、语气活泼一点…" />
          </div>
          <div class="gen-field gen-actions">
            <el-button type="primary" @click="generatePrompt" :disabled="!genProduct">
              <el-icon><MagicStick /></el-icon> 生成提示词
            </el-button>
            <el-button @click="genProduct = ''; genPlatforms = []; genTypes = defaultTypes; genNote = ''">重置</el-button>
          </div>
        </div>

        <!-- 生成结果 -->
        <div v-if="generatedPrompt" class="prompt-output">
          <div class="prompt-output-header">
            <span class="prompt-label">生成的提示词</span>
            <div class="prompt-actions">
              <el-button size="small" text @click="promptCollapsed = !promptCollapsed">
                {{ promptCollapsed ? '展开' : '收起' }}
              </el-button>
              <el-button size="small" type="primary" @click="copyPrompt" :icon="Check" :loading="copying">
                {{ copySuccess ? '已复制！' : '复制' }}
              </el-button>
              <el-button size="small" @click="saveAsDraft">存为草稿</el-button>
            </div>
          </div>
          <div v-show="!promptCollapsed" class="prompt-text">
            <pre>{{ generatedPrompt }}</pre>
          </div>
        </div>
      </div>

      <!-- 文章编辑 -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">
            {{ selectedArticle ? '文章编辑' : '新建文章' }}
            <span v-if="selectedArticle" class="section-subtitle">{{ statusLabel(selectedArticle.status) }}</span>
          </h3>
          <div v-if="selectedArticle" class="section-actions">
            <el-button size="small" type="danger" text @click="deleteArticle">删除</el-button>
          </div>
        </div>

        <el-form label-position="top" class="article-form">
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="关联产品">
                <el-select v-model="articleForm.product_id" size="small" clearable>
                  <el-option v-for="p in data.products" :key="p.id" :label="p.name" :value="p.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="内容类型">
                <el-input v-model="articleForm.content_type" size="small" placeholder="如：产品软文、小红书笔记" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="状态">
                <el-select v-model="articleForm.status" size="small">
                  <el-option label="草稿" value="draft" />
                  <el-option label="待审核" value="review" />
                  <el-option label="已确认" value="approved" />
                  <el-option label="归档" value="archived" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="标题">
            <el-input v-model="articleForm.title" placeholder="文章标题" size="small" />
          </el-form-item>
          <el-form-item label="正文（支持 Markdown）">
            <div class="md-toolbar">
              <el-button-group>
                <el-button size="small" @click="insertMd('## ', '')">H2</el-button>
                <el-button size="small" @click="insertMd('### ', '')">H3</el-button>
                <el-button size="small" @click="insertMd('**', '**')">B</el-button>
                <el-button size="small" @click="insertMd('*', '*')">I</el-button>
                <el-button size="small" @click="insertMd('- ', '')">列表</el-button>
                <el-button size="small" @click="insertMd('> ', '')">引用</el-button>
              </el-button-group>
              <span class="toolbar-tip muted">编辑后自动保存</span>
            </div>
            <el-input
              v-model="articleForm.body"
              type="textarea"
              :rows="12"
              placeholder="在这里粘贴或编辑文章内容…"
              @input="onBodyInput"
            />
          </el-form-item>
          <el-form-item label="预览">
            <div class="md-preview md-content" v-html="renderMd(articleForm.body || '')"></div>
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="8"><el-form-item label="目标平台"><el-input v-model="articleForm.target_platform" size="small" /></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="关键词"><el-input v-model="articleForm.keywords" size="small" /></el-form-item></el-col>
            <el-col :span="8"><el-form-item label="标签"><el-input v-model="articleForm.tags" size="small" /></el-form-item></el-col>
          </el-row>
          <el-form-item label="摘要"><el-input v-model="articleForm.summary" type="textarea" :rows="2" size="small" /></el-form-item>
          <div class="form-actions">
            <el-button type="primary" @click="saveArticle" :loading="saving">保存</el-button>
            <span v-if="lastSaved" class="save-tip muted">{{ lastSaved }}</span>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MagicStick, Check } from '@element-plus/icons-vue'
import { useDataStore } from '@/stores/data'
import { useToast } from '@/composables/useToast'
import { geoApi } from '@/api/client'
import { markdownToHtml } from '@/utils/markdown'
import { buildArticlePrompt } from '@/utils/ai-prompts'
import type { Article, ArticleStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const { success, error: showError, confirm } = useToast()

const searchQuery = ref('')
const filterProduct = ref('')
const filterStatus = ref('')
const saving = ref(false)
const copying = ref(false)
const copySuccess = ref(false)
const lastSaved = ref('')

// 提示词生成器
const genProduct = ref('')
const genPlatforms = ref<string[]>([])
const defaultTypes = ['产品软文']
const genTypes = ref<string[]>([...defaultTypes])
const genNote = ref('')
const generatedPrompt = ref('')
const promptCollapsed = ref(false)

const selectedId = computed(() => route.params.id as string || '')
const selectedArticle = computed(() => data.articles.find(a => a.id === selectedId.value))

const filteredArticles = computed(() => {
  let list = data.articles
  if (filterProduct.value) list = list.filter(a => a.product_id === filterProduct.value)
  if (filterStatus.value) list = list.filter(a => a.status === filterStatus.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter(a => (a.title + a.content_type + a.target_platform + a.tags).toLowerCase().includes(q))
  return list
})

const articleForm = reactive<Partial<Article>>({
  id: '', product_id: '', title: '', body: '', summary: '', content_type: '',
  target_platform: '', keywords: '', tags: '', image_prompt: '', risk_notes: '', status: 'draft',
})

// 自动保存 timer
let saveTimer: ReturnType<typeof setTimeout> | null = null
// 是否处于"新建模式"（避免 watch selectedArticle 覆盖表单）
let isAddingArticle = false

watch(selectedArticle, (a) => {
  // 切换文章前清空 saveTimer，避免旧内容被保存到新文章
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  // 新增模式下不覆盖表单
  if (isAddingArticle) return
  if (a) Object.assign(articleForm, a)
  else Object.assign(articleForm, {
    id: '', product_id: '', title: '', body: '', summary: '', content_type: '',
    target_platform: '', keywords: '', tags: '', image_prompt: '', risk_notes: '', status: 'draft',
  })
}, { immediate: true })

function selectArticle(id: string) {
  isAddingArticle = false
  router.push(`/workshop/${id}`)
}

function startAdd() {
  isAddingArticle = true
  Object.assign(articleForm, {
    id: '', product_id: genProduct.value || '', title: '', body: generatedPrompt.value ? `# 由提示词生成\n\n> ${generatedPrompt.value.substring(0, 100)}...\n\n` : '', summary: '',
    content_type: genTypes.value.join('、'), target_platform: '', keywords: '', tags: '', image_prompt: '', risk_notes: '', status: 'draft',
  })
  // 带 ?new=1 跳过路由守卫的 autoPickFirstItem
  router.push({ path: '/workshop', query: { new: '1' } })
}

// 自动保存
function onBodyInput() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => autoSave(), 1500)
}

async function autoSave() {
  if (!selectedArticle.value || isAddingArticle) return
  try {
    const updated = await geoApi(`/api/articles/${selectedArticle.value.id}`, { method: 'PATCH', body: articleForm })
    const idx = data.articles.findIndex(a => a.id === selectedArticle.value!.id)
    if (idx >= 0) data.articles[idx] = updated
    lastSaved.value = '已自动保存 · ' + new Date().toLocaleTimeString()
  } catch { /* 静默 */ }
}

async function saveArticle() {
  if (!articleForm.title) { showError('请填写标题'); return }
  saving.value = true
  try {
    if (selectedArticle.value && !isAddingArticle) {
      const updated = await geoApi(`/api/articles/${selectedArticle.value.id}`, { method: 'PATCH', body: articleForm })
      const idx = data.articles.findIndex(a => a.id === selectedArticle.value!.id)
      if (idx >= 0) data.articles[idx] = updated
      success('已保存')
      lastSaved.value = '已保存 · ' + new Date().toLocaleTimeString()
    } else {
      const created = await geoApi('/api/articles', { method: 'POST', body: articleForm })
      data.articles.unshift(created)
      success('已创建')
      isAddingArticle = false
      router.push(`/workshop/${created.id}`)
    }
  } catch (e: any) {
    showError('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function deleteArticle() {
  if (!selectedArticle.value) return
  if (!await confirm(`确认删除文章「${selectedArticle.value.title}」？`)) return
  try {
    await geoApi(`/api/articles/${selectedArticle.value.id}`, { method: 'DELETE' })
    data.articles = data.articles.filter(a => a.id !== selectedArticle.value!.id)
    success('已删除')
    if (data.articles.length > 0) router.push(`/workshop/${data.articles[0].id}`)
    else router.push('/workshop')
  } catch (e: any) {
    showError('删除失败：' + e.message)
  }
}

// ===== 提示词生成（本地组装，无需 AI） =====
function generatePrompt() {
  if (!genProduct.value) { showError('请选择产品'); return }
  const product = data.products.find(p => p.id === genProduct.value)
  if (!product) return

  const platforms = genPlatforms.value.length > 0
    ? data.platforms.filter(p => genPlatforms.value.includes(p.id))
    : []
  const questions = data.geo_questions.filter(q => q.product_id === genProduct.value)

  const prompt = buildArticlePrompt(product, platforms, genTypes.value, questions, genNote.value)
  generatedPrompt.value = prompt
  success('提示词已生成，点击复制到剪贴板')
}

async function copyPrompt() {
  if (!generatedPrompt.value) return
  copying.value = true
  try {
    await navigator.clipboard.writeText(generatedPrompt.value)
    copySuccess.value = true
    success('已复制到剪贴板')
    setTimeout(() => {
      copySuccess.value = false
      copying.value = false
    }, 1500)
  } catch {
    showError('复制失败，请手动复制')
    copying.value = false
  }
}

function saveAsDraft() {
  if (!generatedPrompt.value) return
  const product = data.products.find(p => p.id === genProduct.value)
  Object.assign(articleForm, {
    id: '',
    product_id: genProduct.value,
    title: product ? `${product.name} - ${genTypes.value.join('、')} 提示词` : '提示词草稿',
    body: generatedPrompt.value,
    summary: '由提示词生成器生成的软文写作提示词',
    content_type: genTypes.value.join('、'),
    status: 'draft',
  })
  success('已填入编辑器，点击"保存"存入文章库')
}

function insertMd(prefix: string, suffix: string) {
  const textarea = document.querySelector('.article-form textarea') as HTMLTextAreaElement
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = articleForm.body || ''
  const selected = text.substring(start, end)
  const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end)
  articleForm.body = newText
}

function renderMd(text: string) { return markdownToHtml(text) }
function statusLabel(s: ArticleStatus) { return { draft: '草稿', review: '待审核', approved: '已确认', archived: '归档' }[s] || s }
function statusType(s: ArticleStatus): any { return { draft: 'info', review: 'warning', approved: 'success', archived: 'info' }[s] || 'info' }
</script>

<style scoped>
/* 侧边栏筛选 */
.sidebar-filters { display: flex; gap: 8px; padding: 8px 12px; }
.sidebar-filters .el-select { flex: 1; }
.sidebar-search { margin: 0 12px 8px; width: calc(100% - 24px); }

/* 列表项名称扩展 */
.item-name { flex: 1; margin-right: 8px; }

/* 区块标题覆盖 */
.section-header { align-items: flex-start; }
.section-title { margin: 0; display: flex; align-items: center; gap: 6px; }
.section-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}

/* 提示词生成器 */
.prompt-generator {
  background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-bg-color) 60%);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: var(--geo-radius-lg);
  padding: 16px 20px;
}
.gen-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  margin-top: 12px;
}
.gen-field { display: flex; flex-direction: column; gap: 4px; }
.gen-field.full { grid-column: 1 / -1; }
.gen-field label {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}
.gen-actions {
  grid-column: 1 / -1;
  flex-direction: row;
  gap: 8px;
  margin-top: 4px;
}
.gen-actions button { margin-right: 0; }

/* 生成结果 */
.prompt-output {
  margin-top: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--geo-radius);
  overflow: hidden;
  background: var(--el-bg-color);
}
.prompt-output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.prompt-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.prompt-actions { display: flex; gap: 8px; }
.prompt-text {
  max-height: 300px;
  overflow-y: auto;
  padding: 14px 16px;
}
.prompt-text pre {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-primary);
}

/* 文章表单 */
.article-form { margin-top: 4px; }
.md-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.toolbar-tip { font-size: 12px; }
.md-preview {
  min-height: 120px;
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--geo-radius);
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.save-tip { font-size: 12px; }

.muted { color: var(--el-text-color-secondary); }

@media (max-width: 900px) {
  .gen-grid { grid-template-columns: 1fr; }
}
</style>
