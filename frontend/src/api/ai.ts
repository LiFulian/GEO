import { ApiError, ValidationError } from './client'
import { getToken } from './auth'

const CONFIG = {
  pbUrl: (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbUrl) || '',
}

// ===== 全局 loading 引用计数 =====

let _aiLoaderDepth = 0
let _loaderInstance: { close: () => void } | null = null

function _aiLoaderStart() {
  _aiLoaderDepth++
  // 由 composable 注入，避免直接依赖 Element Plus
  if (typeof (window as any).__geoShowLoader === 'function') {
    (window as any).__geoShowLoader()
  }
}

function _aiLoaderEnd() {
  _aiLoaderDepth = Math.max(0, _aiLoaderDepth - 1)
  if (_aiLoaderDepth === 0 && typeof (window as any).__geoHideLoader === 'function') {
    (window as any).__geoHideLoader()
  }
}

// 统一的 AI HTTP 请求：优先走 PB 同源代理，失败回退浏览器直连
export async function aiFetch(targetUrl: string, headers: Record<string, string>, bodyObj: any): Promise<any> {
  _aiLoaderStart()
  try {
    const proxyUrl = `${CONFIG.pbUrl}/api/ai/proxy`
    try {
      const token = await getToken()
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ url: targetUrl, method: 'POST', headers, body: bodyObj }),
      })
      if (proxyRes.status !== 404) {
        const data = await proxyRes.json().catch(() => null)
        if (!proxyRes.ok) {
          const msg = (data && data.error && data.error.message) || `HTTP ${proxyRes.status}`
          throw new ApiError(`AI 调用失败：${msg}`, proxyRes.status)
        }
        return data
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err
    }

    // 直连兜底
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new ApiError(`AI 调用失败：${err.error?.message || `HTTP ${res.status}`}`, res.status)
    }
    return await res.json()
  } finally {
    _aiLoaderEnd()
  }
}

export async function callAI(settings: any, messages: any[]): Promise<string> {
  const baseUrl = settings.text_base_url || settings.base_url || 'https://open.bigmodel.cn/api/paas/v4'
  const model = settings.text_model || settings.model || 'glm-4-flash'
  const defaultKey = (typeof window !== 'undefined' && window.__GEO_ENV__ && window.__GEO_ENV__.VITE_DEFAULT_AI_KEY) || ''
  const apiKey = settings.text_api_key || settings.api_key || defaultKey

  if (!apiKey) throw new ValidationError('请先配置 AI API Key')

  const temperature = parseFloat(settings.temperature || 0.7)

  const data = await aiFetch(`${baseUrl}/chat/completions`, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }, { model, messages, temperature })

  return data.choices[0].message.content
}

export interface StreamCallbacks {
  onThinking?: (text: string) => void
  onContent?: (text: string) => void
  onDone?: (fullText: string, fullThinking?: string) => void
  onError?: (err: Error) => void
}

export async function callAIStream(
  settings: any,
  messages: any[],
  callbacks: StreamCallbacks = {}
): Promise<string> {
  const baseUrl = settings.text_base_url || settings.base_url || 'https://open.bigmodel.cn/api/paas/v4'
  const model = settings.text_model || settings.model || 'glm-4-flash'
  const defaultKey = (typeof window !== 'undefined' && window.__GEO_ENV__ && window.__GEO_ENV__.VITE_DEFAULT_AI_KEY) || ''
  const apiKey = settings.text_api_key || settings.api_key || defaultKey

  if (!apiKey) {
    const err = new ValidationError('请先配置 AI API Key')
    callbacks.onError?.(err)
    throw err
  }

  const temperature = parseFloat(settings.temperature || 0.7)
  const url = `${baseUrl}/chat/completions`

  _aiLoaderStart()
  try {
    let fullContent = ''
    let fullThinking = ''

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          stream: true,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const dataStr = trimmed.slice(5).trim()
          if (!dataStr || dataStr === '[DONE]') continue

          try {
            const data = JSON.parse(dataStr)
            const delta = data.choices?.[0]?.delta
            if (!delta) continue

            if (delta.reasoning_content) {
              fullThinking += delta.reasoning_content
              callbacks.onThinking?.(fullThinking)
            }
            if (delta.content) {
              fullContent += delta.content
              callbacks.onContent?.(fullContent)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      callbacks.onDone?.(fullContent, fullThinking)
      return fullContent
    } catch (streamErr: any) {
      // 流式失败，回退到非流式
      if (fullContent) {
        callbacks.onDone?.(fullContent, fullThinking)
        return fullContent
      }
      const content = await callAI(settings, messages)
      callbacks.onContent?.(content)
      callbacks.onDone?.(content)
      return content
    }
  } catch (err: any) {
    callbacks.onError?.(err)
    throw err
  } finally {
    _aiLoaderEnd()
  }
}

// AI 图片生成
export async function callImageAI(settings: any, prompt: string): Promise<string> {
  const baseUrl = settings.image_base_url || settings.text_base_url || 'https://open.bigmodel.cn/api/paas/v4'
  const model = settings.image_model || 'cogview-3-flash'
  const defaultKey = (typeof window !== 'undefined' && window.__GEO_ENV__ && window.__GEO_ENV__.VITE_DEFAULT_AI_KEY) || ''
  const apiKey = settings.image_api_key || settings.text_api_key || defaultKey

  if (!apiKey) throw new ValidationError('请先配置 AI API Key')

  const data = await aiFetch(`${baseUrl}/images/generations`, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }, { model, prompt })

  return data.data?.[0]?.url || ''
}
