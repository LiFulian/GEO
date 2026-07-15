<template>
  <div class="settings-view">
    <el-card shadow="never">
      <template #header><h3>AI 设置</h3></template>
      <p class="muted">默认已为你配置好「智谱 GLM」模型，只需填入 API Key 即可启用 AI 功能。</p>

      <h4>🚀 快速开始</h4>
      <p class="muted small">到 <el-link type="primary" href="https://open.bigmodel.cn" target="_blank">open.bigmodel.cn</el-link> 注册即可获取免费 API Key（glm-4-flash 免费额度）</p>

      <el-form label-position="top" class="settings-form">
        <el-form-item label="切换预设模型">
          <el-select v-model="selectedPreset" placeholder="选择预设…" @change="applyPreset" style="width: 100%">
            <el-option v-for="(p, i) in AI_PRESETS" :key="i" :label="p.name" :value="i" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="Text API Key">
              <el-input v-model="form.text_api_key" type="password" placeholder="粘贴你的 API Key" show-password />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Image API Key（可选）">
              <el-input v-model="form.image_api_key" type="password" placeholder="留空则复用文本 Key" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-button type="primary" @click="saveSettings" :loading="saving">保存并启用 API 直连</el-button>
        <el-button @click="useManualMode">仅用手动 Prompt</el-button>
      </el-form>

      <el-collapse>
        <el-collapse-item title="高级配置（自定义 Base URL / 模型名）">
          <el-form label-position="top">
            <el-form-item label="模式">
              <el-select v-model="form.mode">
                <el-option label="手动 Prompt" value="manual" />
                <el-option label="API 直连" value="api" />
              </el-select>
            </el-form-item>
            <el-card shadow="never" class="model-box">
              <template #header><strong>文本生成模型</strong></template>
              <el-form-item label="Text Base URL"><el-input v-model="form.text_base_url" /></el-form-item>
              <el-form-item label="Text Model"><el-input v-model="form.text_model" /></el-form-item>
            </el-card>
            <el-card shadow="never" class="model-box">
              <template #header><strong>图片生成模型</strong></template>
              <el-form-item label="Image Base URL"><el-input v-model="form.image_base_url" /></el-form-item>
              <el-form-item label="Image Model"><el-input v-model="form.image_model" /></el-form-item>
            </el-card>
            <el-form-item label="Temperature">
              <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
            </el-form-item>
          </el-form>
        </el-collapse-item>
      </el-collapse>

      <el-alert type="info" :closable="false" class="security-notice">
        <strong>安全提示</strong>：API Key 存储在本地 PocketBase 中，建议使用低权限 Key 并定期轮换。
      </el-alert>
    </el-card>

    <el-divider />

    <el-card shadow="never">
      <template #header><h3>我的自定义模型</h3></template>
      <p class="muted">添加你自己的模型配置（OpenAI-compatible），API Key 仅自己可见。</p>
      <el-table :data="data.user_models" stripe>
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="provider" label="提供商" />
        <el-table-column prop="model" label="模型" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="editModel(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteModel(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-button @click="showAddModel = true" style="margin-top: 12px">+ 添加自定义模型</el-button>
    </el-card>

    <el-dialog v-model="showAddModel" :title="editingModel ? '编辑模型' : '添加自定义模型'" width="500px">
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="modelForm.name" /></el-form-item>
        <el-form-item label="Base URL"><el-input v-model="modelForm.base_url" placeholder="https://api.openai.com/v1" /></el-form-item>
        <el-form-item label="模型名"><el-input v-model="modelForm.model" placeholder="gpt-4o-mini" /></el-form-item>
        <el-form-item label="API Key"><el-input v-model="modelForm.api_key" type="password" show-password /></el-form-item>
        <el-form-item label="提供商"><el-input v-model="modelForm.provider" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddModel = false">取消</el-button>
        <el-button type="primary" @click="saveModel">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useDataStore, AI_PRESETS } from '@/stores/data'
import { useToast } from '@/composables/useToast'
import { geoApi } from '@/api/client'

const data = useDataStore()
const { success, error: showError, confirm } = useToast()

const _defaultKey = (typeof window !== 'undefined' && window.__GEO_ENV__ && window.__GEO_ENV__.VITE_DEFAULT_AI_KEY) || ''

const form = reactive({
  mode: 'manual',
  text_base_url: '',
  text_model: '',
  text_api_key: '',
  image_base_url: '',
  image_model: '',
  image_api_key: '',
  temperature: 0.7,
  preset_index: 0,
})

const selectedPreset = ref<number | null>(null)
const saving = ref(false)
const showAddModel = ref(false)
const editingModel = ref<string | null>(null)
const modelForm = reactive({ name: '', base_url: '', model: '', api_key: '', provider: '' })

onMounted(() => {
  const ai = data.ai_settings
  if (ai && ai.id) {
    Object.assign(form, {
      mode: ai.mode || 'manual',
      text_base_url: ai.text_base_url || '',
      text_model: ai.text_model || '',
      text_api_key: ai.text_api_key || _defaultKey,
      image_base_url: ai.image_base_url || '',
      image_model: ai.image_model || '',
      image_api_key: ai.image_api_key || _defaultKey,
      temperature: ai.temperature ?? 0.7,
      preset_index: ai.preset_index ?? 0,
    })
    selectedPreset.value = ai.preset_index ?? null
  }
})

function applyPreset(index: number) {
  const p = AI_PRESETS[index]
  form.text_base_url = p.text_base_url
  form.text_model = p.text_model
  form.image_base_url = p.image_base_url
  form.image_model = p.image_model
  form.preset_index = index
  if (_defaultKey && !form.text_api_key) {
    form.text_api_key = _defaultKey
    form.image_api_key = _defaultKey
  }
}

async function saveSettings() {
  saving.value = true
  try {
    form.mode = 'api'
    const ai = data.ai_settings
    if (ai && ai.id) {
      const updated = await geoApi(`/api/ai_settings/${ai.id}`, { method: 'PATCH', body: form })
      data.ai_settings = updated
    } else {
      const created = await geoApi('/api/ai_settings', { method: 'POST', body: form })
      data.ai_settings = created
    }
    success('AI 设置已保存')
  } catch (e: any) {
    showError('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function useManualMode() {
  form.mode = 'manual'
  await saveSettings()
}

function editModel(row: any) {
  editingModel.value = row.id
  Object.assign(modelForm, { name: row.name, base_url: row.base_url, model: row.model, api_key: row.api_key, provider: row.provider })
  showAddModel.value = true
}

async function deleteModel(row: any) {
  if (!await confirm(`确认删除模型「${row.name}」？`)) return
  try {
    await geoApi(`/api/user_models/${row.id}`, { method: 'DELETE' })
    data.user_models = data.user_models.filter(m => m.id !== row.id)
    success('已删除')
  } catch (e: any) {
    showError('删除失败：' + e.message)
  }
}

async function saveModel() {
  try {
    if (editingModel.value) {
      const updated = await geoApi(`/api/user_models/${editingModel.value}`, { method: 'PATCH', body: modelForm })
      const idx = data.user_models.findIndex(m => m.id === editingModel.value)
      if (idx >= 0) data.user_models[idx] = updated
    } else {
      const created = await geoApi('/api/user_models', { method: 'POST', body: modelForm })
      data.user_models.push(created)
    }
    success('已保存')
    showAddModel.value = false
    editingModel.value = null
    Object.assign(modelForm, { name: '', base_url: '', model: '', api_key: '', provider: '' })
  } catch (e: any) {
    showError('保存失败：' + e.message)
  }
}
</script>

<style scoped>
.settings-view {
  max-width: 800px;
}

.settings-form {
  margin-top: 16px;
}

.muted {
  color: var(--el-text-color-secondary);
}

.small {
  font-size: 12px;
}

.model-box {
  margin-bottom: 12px;
}

.security-notice {
  margin-top: 16px;
}
</style>
