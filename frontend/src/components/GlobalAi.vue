<template>
  <el-drawer v-model="visible" direction="rtl" size="440px" @open="onOpen" class="ai-drawer">
    <template #header>
      <div class="ai-drawer-header">
        <h3>AI 助手</h3>
        <el-tooltip content="清空对话" placement="bottom">
          <el-button :icon="Delete" size="small" text @click="clearMessages" />
        </el-tooltip>
      </div>
    </template>
    <div class="ai-messages" ref="messagesRef">
      <div v-for="(msg, i) in messages" :key="i" :class="['ai-msg', msg.role]">
        <template v-if="msg.role === 'assistant'">
          <div v-if="msg.thinking" class="ai-thinking" :class="{ expanded: msg._showThinking }" @click="msg._showThinking = !msg._showThinking">
            <div class="thinking-head">
              <span class="thinking-icon">
                <el-icon v-if="msg.thinkingDone"><Check /></el-icon>
                <el-icon v-else :class="{'is-loading': true}"><Loading /></el-icon>
              </span>
              <span class="thinking-label">{{ msg.thinkingDone ? '思考完成' : '正在思考…' }}</span>
              <el-icon class="thinking-toggle"><CaretBottom /></el-icon>
            </div>
            <div v-if="msg._showThinking" class="thinking-body" v-html="renderMarkdown(msg.thinking)"></div>
          </div>
          <div class="ai-content" v-html="renderMarkdown(msg.content)"></div>
          <div v-if="msg._streaming && !msg.content" class="typing-cursor">
            <span></span><span></span><span></span>
          </div>
        </template>
        <template v-else>
          <div v-html="renderMarkdown(msg.content)"></div>
        </template>
      </div>
    </div>
    <template #footer>
      <div class="ai-input-bar">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          placeholder="输入问题，Enter 发送，Shift+Enter 换行（⌘/ 打开）"
          @keydown.enter.exact.prevent="send"
        />
        <el-button type="primary" @click="send" :loading="loading">发送</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { CaretBottom, Check, Loading, Delete } from '@element-plus/icons-vue'
import { useDataStore } from '@/stores/data'
import { callAIStream } from '@/api/ai'
import { markdownToHtml } from '@/utils/markdown'

const data = useDataStore()
const visible = ref(false)
const input = ref('')
const loading = ref(false)
const messages = ref<any[]>([])
const messagesRef = ref()

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

function onOpen() {
  if (messages.value.length === 0) {
    messages.value.push({
      role: 'assistant',
      content: '你好！我是全局AI助手，可以帮你：\n\n- 分析内容质量\n- 生成写作灵感\n- 优化产品描述\n- 回答使用问题\n\n有什么可以帮你的？',
    })
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((isMac ? e.metaKey : e.ctrlKey) && e.key === '/') {
    e.preventDefault()
    visible.value = true
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

function clearMessages() {
  messages.value = []
  onOpen()
}

function renderMarkdown(text: string) {
  return markdownToHtml(text || '')
}

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''

  const userMsg = { role: 'user', content: text }
  const aiMsg: any = { role: 'assistant', content: '', thinking: '', thinkingDone: false, _streaming: true, _showThinking: false }
  messages.value.push(userMsg, aiMsg)
  await scrollDown()

  loading.value = true
  try {
    const systemPrompt = `你是 GEO Studio 的AI助手。GEO Studio是一个生成式引擎优化（GEO）内容工作台，帮助用户管理产品档案、挖掘GEO问题、生成内容、跟踪发布。
请用简洁、专业的语气回答用户问题。如果是关于产品内容优化、GEO策略、写作建议等问题，请给出具体可操作的建议。`
    const msgs = [
      { role: 'system', content: systemPrompt },
      ...messages.value.filter(m => !m._streaming).slice(-12).map(m => ({ role: m.role, content: m.content })),
    ]

    await callAIStream(data.ai_settings, msgs, {
      onThinking: (t) => {
        aiMsg.thinking = t
        if (!aiMsg._showThinking && t.length > 20) aiMsg._showThinking = true
        scrollDown()
      },
      onContent: (t) => {
        aiMsg.content = t
        if (t && aiMsg._showThinking && t.length > 50) aiMsg._showThinking = false
        scrollDown()
      },
      onDone: () => {
        aiMsg._streaming = false
        aiMsg.thinkingDone = true
        scrollDown()
      },
      onError: (e) => {
        aiMsg._streaming = false
        aiMsg.content = '抱歉，AI调用失败：' + e.message
      },
    })
  } catch (e: any) {
    // 已在 onError 处理
  } finally {
    loading.value = false
    await scrollDown()
  }
}

async function scrollDown() {
  await nextTick()
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}
</script>

<style scoped>
.ai-messages {
  height: 100%;
  overflow-y: auto;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-msg {
  padding: 12px 16px;
  border-radius: 12px;
  max-width: 90%;
  line-height: 1.65;
  font-size: 14px;
  word-break: break-word;
}

.ai-msg.assistant {
  background: var(--el-fill-color-light);
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

.ai-msg.user {
  background: linear-gradient(135deg, var(--el-color-primary-light-8), var(--el-color-primary-light-7));
  color: var(--el-color-primary-dark-2);
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

.ai-thinking {
  margin-bottom: 10px;
  padding: 8px 12px;
  background: rgba(144, 147, 153, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-thinking:hover {
  background: rgba(144, 147, 153, 0.18);
}

.thinking-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.thinking-icon {
  display: flex;
  color: var(--el-color-primary);
}

.thinking-toggle {
  margin-left: auto;
  font-size: 12px;
  transition: transform 0.2s;
}

.ai-thinking.expanded .thinking-toggle {
  transform: rotate(180deg);
}

.thinking-body {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  opacity: 0.8;
  max-height: 200px;
  overflow-y: auto;
}

.ai-content {
  position: relative;
}

.typing-cursor {
  display: inline-flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-cursor span {
  width: 6px;
  height: 6px;
  background: var(--el-color-primary);
  border-radius: 50%;
  animation: typing-bounce 1.2s infinite ease-in-out;
}

.typing-cursor span:nth-child(2) { animation-delay: 0.15s; }
.typing-cursor span:nth-child(3) { animation-delay: 0.3s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.ai-input-bar {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
</style>
