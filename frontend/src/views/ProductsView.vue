<template>
  <div class="split-layout">
    <div class="split-sidebar">
      <div class="sidebar-header">
        <h3>产品列表</h3>
        <el-button type="primary" size="small" @click="startAdd">+ 新增</el-button>
      </div>
      <el-input v-model="searchQuery" placeholder="搜索产品…" clearable size="small" class="sidebar-search" />
      <div class="sidebar-list">
        <div
          v-for="p in filteredProducts"
          :key="p.id"
          :class="['list-item', { active: p.id === selectedId }]"
          @click="selectProduct(p.id)"
        >
          <span class="item-name">{{ p.name }}</span>
          <el-tag size="small" :type="productStatusType(p.status)" effect="light">{{ productStatusLabel(p.status) }}</el-tag>
        </div>
        <el-empty v-if="filteredProducts.length === 0" :image-size="48" description="暂无产品" />
      </div>
      <div class="sidebar-footer muted">{{ filteredProducts.length }} 个产品</div>
    </div>

    <div class="split-main">
      <div v-if="!selectedProduct && !isAdding" class="empty-center">
        <el-empty description="选择左侧产品查看详情" />
      </div>
      <div v-else class="product-detail">
        <!-- 头部 -->
        <div class="detail-header">
          <div class="detail-title">
            <h2 v-if="!isEditingMode">{{ selectedProduct?.name || '新增产品' }}</h2>
            <el-input v-else v-model="formData.name" class="title-input" placeholder="产品名称" />
            <div v-if="!isEditingMode" class="title-tags">
              <el-tag size="small" :type="productStatusType(selectedProduct?.status || 'active')" effect="light">{{ productStatusLabel(selectedProduct?.status || 'active') }}</el-tag>
              <el-tag v-if="productQuestions.length" size="small" type="info" effect="plain">{{ productQuestions.length }} 个 GEO 问题</el-tag>
            </div>
          </div>
          <div class="detail-actions">
            <template v-if="!isEditingMode">
              <el-button size="small" @click="openUrl(selectedProduct?.url || '')" :disabled="!selectedProduct?.url">打开 ↗</el-button>
              <el-button size="small" type="primary" @click="startEdit">编辑</el-button>
              <el-button size="small" type="danger" plain @click="deleteProduct">删除</el-button>
            </template>
            <template v-else>
              <el-button size="small" @click="cancelEdit">取消</el-button>
              <el-button size="small" type="primary" @click="save" :loading="saving">保存</el-button>
            </template>
          </div>
        </div>

        <!-- 基础信息 -->
        <div class="section">
          <h3 class="section-title">基础信息</h3>
          <div class="detail-grid">
            <div class="detail-field">
              <label>类型</label>
              <div class="field-value">
                <span v-if="!isEditingMode" class="value-text">{{ selectedProduct?.type || '—' }}</span>
                <el-input v-else v-model="formData.type" placeholder="网站/小程序/SaaS/App" size="small" />
              </div>
            </div>
            <div class="detail-field">
              <label>状态</label>
              <div class="field-value">
                <el-tag v-if="!isEditingMode" size="small" :type="productStatusType(selectedProduct?.status || 'active')" effect="light">{{ productStatusLabel(selectedProduct?.status || 'active') }}</el-tag>
                <el-select v-else v-model="formData.status" size="small">
                  <el-option label="活跃" value="active" />
                  <el-option label="草稿" value="draft" />
                  <el-option label="暂停" value="paused" />
                  <el-option label="归档" value="archived" />
                </el-select>
              </div>
            </div>
            <div class="detail-field">
              <label>链接</label>
              <div class="field-value">
                <el-link v-if="!isEditingMode && selectedProduct?.url" :href="selectedProduct.url" target="_blank" type="primary">{{ selectedProduct.url }}</el-link>
                <span v-else-if="!isEditingMode" class="placeholder">未配置</span>
                <el-input v-else v-model="formData.url" placeholder="https://" size="small" />
              </div>
            </div>
            <div class="detail-field">
              <label>目标用户</label>
              <div class="field-value">
                <span v-if="!isEditingMode" class="value-text">{{ selectedProduct?.audience || '—' }}</span>
                <el-input v-else v-model="formData.audience" size="small" />
              </div>
            </div>
            <div class="detail-field full-width">
              <label>核心卖点</label>
              <div class="field-value">
                <div v-if="!isEditingMode" class="md-content value-text" v-html="renderMd(selectedProduct?.selling_points || '')"></div>
                <el-input v-else v-model="formData.selling_points" type="textarea" :rows="3" size="small" placeholder="支持 Markdown" />
              </div>
            </div>
            <div class="detail-field full-width">
              <label>竞品 / 替代品</label>
              <div class="field-value">
                <span v-if="!isEditingMode" class="value-text">{{ selectedProduct?.competitors || '—' }}</span>
                <el-input v-else v-model="formData.competitors" type="textarea" :rows="2" size="small" />
              </div>
            </div>
            <div class="detail-field">
              <label>品牌语气</label>
              <div class="field-value">
                <span v-if="!isEditingMode" class="value-text">{{ selectedProduct?.tone || '—' }}</span>
                <el-input v-else v-model="formData.tone" size="small" />
              </div>
            </div>
            <div class="detail-field">
              <label>转化目标</label>
              <div class="field-value">
                <span v-if="!isEditingMode" class="value-text">{{ selectedProduct?.goal || '—' }}</span>
                <el-input v-else v-model="formData.goal" size="small" />
              </div>
            </div>
            <div class="detail-field full-width">
              <label>禁用表达</label>
              <div class="field-value">
                <span v-if="!isEditingMode" class="value-text">{{ selectedProduct?.forbidden_words || '—' }}</span>
                <el-input v-else v-model="formData.forbidden_words" type="textarea" :rows="2" size="small" />
              </div>
            </div>
          </div>
        </div>

        <!-- GEO 问题 -->
        <div class="section">
          <div class="section-header">
            <h3 class="section-title">GEO 问题 <span class="section-count">{{ productQuestions.length }}</span></h3>
            <div class="section-actions">
              <el-button size="small" @click="addGeoQuestion">+ 新建问题</el-button>
              <el-button size="small" type="primary" @click="generateGeoQuestions" :loading="generating">
                <el-icon><MagicStick /></el-icon> AI 批量生成
              </el-button>
            </div>
          </div>

          <div v-if="productQuestions.length === 0" class="geo-empty">
            <el-empty description="暂无 GEO 问题，点击右侧按钮或 AI 生成" :image-size="60" />
          </div>

          <div v-else class="geo-list">
            <!-- 新增中的问题 -->
            <div v-if="geoAdding" class="geo-item geo-editing">
              <div class="geo-edit-form">
                <el-input v-model="geoForm.question" type="textarea" :rows="2" placeholder="问题" size="small" />
                <div class="geo-edit-row">
                  <el-select v-model="geoForm.intent" size="small" placeholder="意图" style="width: 120px">
                    <el-option label="发现" value="discovery" />
                    <el-option label="对比" value="comparison" />
                    <el-option label="操作" value="howto" />
                    <el-option label="评估" value="evaluation" />
                  </el-select>
                  <el-input v-model="geoForm.audience" placeholder="人群" size="small" style="width: 140px" />
                  <el-select v-model="geoForm.priority" size="small" style="width: 100px">
                    <el-option label="高优" value="high" />
                    <el-option label="中优" value="medium" />
                    <el-option label="低优" value="low" />
                  </el-select>
                  <el-select v-model="geoForm.status" size="small" style="width: 100px">
                    <el-option label="活跃" value="active" />
                    <el-option label="已覆盖" value="covered" />
                    <el-option label="暂停" value="paused" />
                  </el-select>
                </div>
                <el-input v-model="geoForm.content_angle" type="textarea" :rows="2" placeholder="内容角度" size="small" />
                <div class="geo-edit-actions">
                  <el-button size="small" @click="cancelGeoAdd">取消</el-button>
                  <el-button size="small" type="primary" @click="saveGeoQuestion" :loading="saving">保存</el-button>
                </div>
              </div>
            </div>

            <!-- 已有问题 -->
            <div v-for="q in productQuestions" :key="q.id" class="geo-item" :class="{ 'geo-editing': editingGeoId === q.id }">
              <!-- 查看模式 -->
              <template v-if="editingGeoId !== q.id">
                <div class="geo-card" @click="editGeoQuestion(q)">
                  <div class="geo-card-top">
                    <div class="geo-tags">
                      <el-tag size="small" :type="priorityType(q.priority)" effect="light">{{ priorityLabel(q.priority) }}</el-tag>
                      <el-tag size="small" :type="geoStatusType(q.status)" effect="plain">{{ geoStatusLabel(q.status) }}</el-tag>
                      <el-tag v-if="q.intent" size="small" effect="plain" type="info">{{ intentLabel(q.intent) }}</el-tag>
                    </div>
                    <el-icon class="geo-expand-icon"><ArrowDown /></el-icon>
                  </div>
                  <p class="geo-question">{{ q.question }}</p>
                  <div v-if="q.content_angle || q.audience" class="geo-meta">
                    <span v-if="q.audience" class="geo-meta-item">人群：{{ q.audience }}</span>
                    <span v-if="q.content_angle" class="geo-meta-item">角度：{{ q.content_angle }}</span>
                  </div>
                </div>
              </template>
              <!-- 编辑模式 -->
              <template v-else>
                <div class="geo-edit-form">
                  <el-input v-model="geoForm.question" type="textarea" :rows="2" placeholder="问题" size="small" />
                  <div class="geo-edit-row">
                    <el-select v-model="geoForm.intent" size="small" placeholder="意图" style="width: 120px">
                      <el-option label="发现" value="discovery" />
                      <el-option label="对比" value="comparison" />
                      <el-option label="操作" value="howto" />
                      <el-option label="评估" value="evaluation" />
                    </el-select>
                    <el-input v-model="geoForm.audience" placeholder="人群" size="small" style="width: 140px" />
                    <el-select v-model="geoForm.priority" size="small" style="width: 100px">
                      <el-option label="高优" value="high" />
                      <el-option label="中优" value="medium" />
                      <el-option label="低优" value="low" />
                    </el-select>
                    <el-select v-model="geoForm.status" size="small" style="width: 100px">
                      <el-option label="活跃" value="active" />
                      <el-option label="已覆盖" value="covered" />
                      <el-option label="暂停" value="paused" />
                    </el-select>
                  </div>
                  <el-input v-model="geoForm.content_angle" type="textarea" :rows="2" placeholder="内容角度" size="small" />
                  <div class="geo-edit-actions">
                    <el-button size="small" type="danger" text @click="deleteGeoQuestion">删除</el-button>
                    <div class="flex-grow"></div>
                    <el-button size="small" @click="cancelGeoEdit">取消</el-button>
                    <el-button size="small" type="primary" @click="saveGeoQuestion" :loading="saving">保存</el-button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 深度编辑 -->
        <div v-if="selectedProduct" class="section">
          <h3 class="section-title">深度档案</h3>
          <div class="deep-edit">
            <el-input
              v-model="deepContent"
              type="textarea"
              :rows="12"
              placeholder="使用 Markdown 自由编写产品深度档案…（自动保存）"
              @input="onDeepInput"
            />
            <div class="deep-preview">
              <h4>预览</h4>
              <div class="md-content" v-html="renderMd(deepContent)"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- AI 生成进度 -->
  <el-dialog v-model="genDialogVisible" title="AI 正在生成 GEO 问题" width="480px" :close-on-click-modal="false" :show-close="false" class="gen-progress-dialog">
    <div class="gen-steps">
      <div v-for="(step, i) in genSteps" :key="i" :class="['gen-step', { active: genStepIndex === i, done: genStepIndex > i }]">
        <div class="step-icon">
          <el-icon v-if="genStepIndex > i"><Check /></el-icon>
          <el-icon v-else-if="genStepIndex === i" :class="{'is-loading': true}"><Loading /></el-icon>
          <span v-else>{{ i + 1 }}</span>
        </div>
        <div class="step-text">
          <div class="step-title">{{ step.title }}</div>
          <div class="step-desc">{{ step.desc }}</div>
        </div>
      </div>
    </div>
    <div v-if="genResultText" class="gen-result-preview">
      <div class="preview-label">生成中预览…</div>
      <div class="preview-text">{{ genResultText.slice(0, 300) }}{{ genResultText.length > 300 ? '…' : '' }}</div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Check, Loading, MagicStick } from '@element-plus/icons-vue'
import { useDataStore } from '@/stores/data'
import { useToast } from '@/composables/useToast'
import { geoApi } from '@/api/client'
import { callAIStream } from '@/api/ai'
import { markdownToHtml } from '@/utils/markdown'
import { buildGeoQuestionPrompt, extractJsonArray } from '@/utils/ai-prompts'
import type { Product, ProductStatus, GeoQuestion, Priority, GeoQuestionStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const { success, error: showError, confirm } = useToast()

const searchQuery = ref('')
const isEditing = ref(false)
const isAdding = ref(false)
const saving = ref(false)
const generating = ref(false)
const genDialogVisible = ref(false)
const genStepIndex = ref(0)
const genResultText = ref('')
const genSteps = [
  { title: '分析产品信息', desc: '理解产品定位与核心卖点' },
  { title: '挖掘用户问题', desc: '从多角度发散用户真实疑问' },
  { title: '分类与整理', desc: '按意图、优先级分类整理' },
  { title: '写入问题库', desc: '批量创建 GEO 问题' },
]
const deepContent = ref('')
let deepSaveTimer: ReturnType<typeof setTimeout> | null = null

// GEO 问题编辑
const editingGeoId = ref('')
const geoAdding = ref(false)
const geoForm = reactive<Partial<GeoQuestion>>({
  question: '', intent: 'discovery', audience: '', content_angle: '',
  priority: 'medium', status: 'active', product_id: '',
})

const selectedId = computed(() => route.params.id as string || '')
const selectedProduct = computed(() => data.products.find(p => p.id === selectedId.value))
const productQuestions = computed(() => data.geo_questions.filter(q => q.product_id === selectedId.value))
const isEditingMode = computed(() => isEditing.value || isAdding.value)

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return data.products
  return data.products.filter(p => (p.name + p.type + p.audience).toLowerCase().includes(q))
})

watch(selectedProduct, (p) => {
  // 切换产品前先清空 deepSaveTimer，避免旧内容被保存到新产品
  if (deepSaveTimer) { clearTimeout(deepSaveTimer); deepSaveTimer = null }
  if (p) deepContent.value = p.deep_content || ''
}, { immediate: true })

// 切换产品时关闭编辑态（仅当 selectedId 真正变化时，不重置新增态）
watch(selectedId, (newId, oldId) => {
  if (newId === oldId) return
  isEditing.value = false
  editingGeoId.value = ''
  geoAdding.value = false
})

function selectProduct(id: string) {
  router.push(`/products/${id}`)
}

function openUrl(url: string) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

// ===== 产品表单 =====
const formData = reactive<Partial<Product>>({
  name: '', type: '', url: '', audience: '', selling_points: '',
  competitors: '', tone: '', goal: '', forbidden_words: '', status: 'active',
})

function startAdd() {
  isAdding.value = true
  isEditing.value = false
  editingGeoId.value = ''
  geoAdding.value = false
  Object.assign(formData, {
    name: '', type: '', url: '', audience: '', selling_points: '',
    competitors: '', tone: '真实、专业、克制', goal: '', forbidden_words: '', status: 'active',
  })
  // 带 ?new=1 跳过路由守卫的 autoPickFirstItem，避免 watch selectedId 重置 isAdding
  if (route.query.new !== '1') {
    router.push({ path: '/products', query: { new: '1' } })
  }
}

// 从 Dashboard 快捷操作跳转过来时自动进入新增模式
onMounted(() => {
  if (route.query.new === '1' && !route.params.id) startAdd()
})

function startEdit() {
  if (!selectedProduct.value) return
  isEditing.value = true
  isAdding.value = false
  Object.assign(formData, selectedProduct.value)
}

function cancelEdit() {
  const wasAdding = isAdding.value
  isEditing.value = false
  isAdding.value = false
  if (wasAdding) {
    // 取消新增：回到第一项或清掉 ?new=1
    if (data.products.length > 0) {
      router.push(`/products/${data.products[0].id}`)
    } else {
      router.push('/products')
    }
  }
}

async function save() {
  if (!formData.name) { showError('请填写名称'); return }
  saving.value = true
  try {
    if (isEditing.value && selectedProduct.value) {
      const updated = await geoApi(`/api/products/${selectedProduct.value.id}`, { method: 'PATCH', body: formData })
      const idx = data.products.findIndex(p => p.id === selectedProduct.value!.id)
      if (idx >= 0) data.products[idx] = updated
      success('已保存')
      isEditing.value = false
    } else {
      const created = await geoApi('/api/products', { method: 'POST', body: formData })
      data.products.unshift(created)
      success('已创建')
      isAdding.value = false
      router.push(`/products/${created.id}`)
    }
  } catch (e: any) {
    showError('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function deleteProduct() {
  if (!selectedProduct.value) return
  if (!await confirm(`确认删除产品「${selectedProduct.value.name}」？相关 GEO 问题保留但失去关联。`)) return
  try {
    await geoApi(`/api/products/${selectedProduct.value.id}`, { method: 'DELETE' })
    data.products = data.products.filter(p => p.id !== selectedProduct.value!.id)
    success('已删除')
    if (data.products.length > 0) router.push(`/products/${data.products[0].id}`)
    else router.push('/products')
  } catch (e: any) {
    showError('删除失败：' + e.message)
  }
}

// ===== 深度编辑自动保存 =====
function onDeepInput() {
  if (deepSaveTimer) clearTimeout(deepSaveTimer)
  deepSaveTimer = setTimeout(async () => {
    if (!selectedProduct.value) return
    try {
      await geoApi(`/api/products/${selectedProduct.value.id}`, { method: 'PATCH', body: { deep_content: deepContent.value } })
    } catch { /* 静默 */ }
  }, 1000)
}

// ===== GEO 问题 =====
function addGeoQuestion() {
  geoAdding.value = true
  editingGeoId.value = ''
  Object.assign(geoForm, {
    question: '', intent: 'discovery', audience: '', content_angle: '',
    priority: 'medium', status: 'active', product_id: selectedId.value,
  })
}

function editGeoQuestion(q: GeoQuestion) {
  editingGeoId.value = q.id
  geoAdding.value = false
  Object.assign(geoForm, q)
}

function cancelGeoEdit() {
  editingGeoId.value = ''
}

function cancelGeoAdd() {
  geoAdding.value = false
}

async function saveGeoQuestion() {
  if (!geoForm.question) { showError('请填写问题'); return }
  saving.value = true
  try {
    if (editingGeoId.value && geoForm.id) {
      const updated = await geoApi(`/api/geo_questions/${geoForm.id}`, { method: 'PATCH', body: geoForm })
      const idx = data.geo_questions.findIndex(q => q.id === geoForm.id)
      if (idx >= 0) data.geo_questions[idx] = updated
      success('已保存')
      editingGeoId.value = ''
    } else {
      geoForm.product_id = selectedId.value
      const created = await geoApi('/api/geo_questions', { method: 'POST', body: geoForm })
      data.geo_questions.unshift(created)
      success('已创建')
      geoAdding.value = false
    }
  } catch (e: any) {
    showError('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function deleteGeoQuestion() {
  if (!geoForm.id) return
  if (!await confirm('确认删除这个 GEO 问题？')) return
  try {
    await geoApi(`/api/geo_questions/${geoForm.id}`, { method: 'DELETE' })
    data.geo_questions = data.geo_questions.filter(q => q.id !== geoForm.id)
    success('已删除')
    editingGeoId.value = ''
  } catch (e: any) {
    showError('删除失败：' + e.message)
  }
}

async function generateGeoQuestions() {
  if (!selectedProduct.value) return
  generating.value = true
  genDialogVisible.value = true
  genStepIndex.value = 0
  genResultText.value = ''

  try {
    const prompt = buildGeoQuestionPrompt(selectedProduct.value, 12)

    // 步骤 1-2：AI 生成 + 流式预览
    let raw = ''
    await callAIStream(data.ai_settings, [{ role: 'user', content: prompt }], {
      onThinking: () => {
        if (genStepIndex.value === 0) genStepIndex.value = 1
      },
      onContent: (t) => {
        raw = t
        genResultText.value = t
        if (genStepIndex.value < 2) genStepIndex.value = 2
      },
    })

    // 步骤 3：解析
    genStepIndex.value = 2
    await new Promise(r => setTimeout(r, 300))
    const questions = extractJsonArray(raw)

    // 步骤 4：写入
    genStepIndex.value = 3
    for (const q of questions) {
      const payload = {
        product_id: selectedId.value,
        question: q.question || '',
        intent: q.intent || 'discovery',
        audience: q.audience || '',
        content_angle: q.content_angle || '',
        priority: q.priority || 'medium',
        status: 'active',
      }
      const created = await geoApi('/api/geo_questions', { method: 'POST', body: payload })
      data.geo_questions.unshift(created)
    }

    genStepIndex.value = 4
    await new Promise(r => setTimeout(r, 500))
    success(`已生成 ${questions.length} 个 GEO 问题`)
  } catch (e: any) {
    showError('生成失败：' + e.message)
  } finally {
    generating.value = false
    genDialogVisible.value = false
  }
}

function renderMd(text: string) { return markdownToHtml(text) }

function productStatusLabel(status: ProductStatus) {
  return { active: '活跃', draft: '草稿', paused: '暂停', archived: '归档' }[status] || status
}
function productStatusType(status: ProductStatus): any {
  return { active: 'success', draft: 'info', paused: 'warning', archived: 'info' }[status] || 'info'
}
function priorityLabel(p: Priority) { return { high: '高优', medium: '中优', low: '低优' }[p] || p }
function priorityType(p: Priority): any { return { high: 'danger', medium: 'warning', low: 'info' }[p] || 'info' }
function geoStatusLabel(s: GeoQuestionStatus) { return { active: '活跃', covered: '已覆盖', paused: '暂停' }[s] || s }
function geoStatusType(s: GeoQuestionStatus): any { return { active: 'success', covered: 'info', paused: 'warning' }[s] || 'info' }
function intentLabel(i: string) { return { discovery: '发现', comparison: '对比', howto: '操作', evaluation: '评估' }[i] || i }
</script>

<style scoped>
/* 详情区 */
.product-detail { min-height: 100%; }

/* GEO 列表 */
.geo-empty { padding: 20px 0; }
.geo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.geo-item { border-radius: var(--geo-radius-lg); overflow: hidden; }

.geo-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--geo-radius-lg);
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.geo-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--geo-shadow-sm);
}
.geo-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.geo-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.geo-expand-icon {
  color: var(--el-text-color-disabled);
  font-size: 14px;
  transition: transform 0.2s;
}
.geo-card:hover .geo-expand-icon { color: var(--el-color-primary); }
.geo-question {
  font-weight: 500;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}
.geo-meta {
  display: flex;
  gap: 16px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.geo-meta-item { flex-shrink: 0; }

/* GEO 编辑表单 */
.geo-editing {
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: var(--geo-radius-lg);
}
.geo-edit-form {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.geo-edit-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.geo-edit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.flex-grow { flex: 1; }

/* 深度编辑 */
.deep-edit {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.deep-preview {
  background: var(--el-fill-color-light);
  border-radius: var(--geo-radius);
  padding: 12px 16px;
  min-height: 200px;
}
.deep-preview h4 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.muted { color: var(--el-text-color-secondary); }

@media (max-width: 900px) {
  .detail-grid { grid-template-columns: 1fr; }
  .deep-edit { grid-template-columns: 1fr; }
}

/* AI 生成进度对话框 */
.gen-progress-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.gen-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gen-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  opacity: 0.4;
  transition: all 0.3s ease;
}

.gen-step.active {
  opacity: 1;
}

.gen-step.done {
  opacity: 0.7;
}

.step-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.gen-step.active .step-icon {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.gen-step.done .step-icon {
  background: var(--el-color-success-light-8);
  color: var(--el-color-success);
}

.step-text {
  flex: 1;
  padding-top: 4px;
}

.step-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.step-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.gen-result-preview {
  margin-top: 20px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.preview-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.preview-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  max-height: 120px;
  overflow-y: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap;
}
</style>
