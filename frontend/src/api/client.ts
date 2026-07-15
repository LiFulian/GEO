import type { BootstrapData, Coverage } from '@/types'
import { getToken, getCurrentUserId, logout } from './auth'

// ===== 配置 =====

const CONFIG = {
  pbUrl: (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbUrl) || '',
}

// ===== 错误类型 =====

export class ApiError extends Error {
  status: number
  code: string
  constructor(message: string, status = 500, code = 'API_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id: string) {
    super(`${resource} (id=${id}) 不存在`, 404, 'NOT_FOUND')
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 422, 'VALIDATION_ERROR')
  }
}

// ===== HTTP 请求 =====

async function apiRequest(path: string, { method = 'GET', body = null, headers = {} }: { method?: string; body?: any; headers?: Record<string, string> } = {}): Promise<any> {
  const token = await getToken()

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      ...headers,
    },
  }

  if (body && method !== 'GET') {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const url = `${CONFIG.pbUrl}${path}`

  let res: Response
  try {
    res = await fetch(url, fetchOptions)
  } catch (err: any) {
    if (err.message === 'Failed to fetch') {
      throw new ApiError('无法连接到后台服务，请确认 PocketBase 已启动', 0, 'CONNECTION_ERROR')
    }
    throw err
  }

  // 5xx 自动重试
  if (res.status >= 500 && method === 'GET') {
    for (let attempt = 0; attempt < 2; attempt++) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      res = await fetch(url, { headers: { Authorization: token } })
      if (res.ok) break
    }
  }

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const msg = (data && data.message) || `请求失败 (HTTP ${res.status})`
    if (res.status === 401) {
      logout()
      throw new ApiError('登录已过期，请重新登录', 401, 'UNAUTHORIZED')
    }
    if (res.status === 404) throw new NotFoundError(path, '')
    if (res.status === 400) throw new ValidationError(msg)
    throw new ApiError(msg, res.status)
  }

  return data
}

// ===== 路径翻译 =====

const COLLECTION_MAP: Record<string, string> = {
  products: 'products',
  geo_questions: 'geo_questions',
  platforms: 'platforms',
  contents: 'articles',
  articles: 'articles',
  tasks: 'publish_tasks',
  ai_settings: 'ai_settings',
  user_models: 'user_models',
  product_images: 'product_images',
  skills: 'skills',
}

const ACTION_PATHS = new Set(['/api/bootstrap', '/api/coverage', '/api/backup', '/api/tasks/assign'])

function translatePath(path: string, _method: string) {
  if (ACTION_PATHS.has(path)) return { type: 'action' as const, path }

  const parts = path.replace(/^\/api\//, '').split('/')
  const resource = parts[0]

  if (parts.length === 2 && /^[a-z0-9]+$/i.test(parts[1]) && parts[1].length >= 10) {
    const collection = COLLECTION_MAP[resource]
    if (!collection) return { type: 'action' as const, path }
    return { type: 'record' as const, collection, id: parts[1] }
  }

  if (COLLECTION_MAP[resource]) {
    return { type: 'list' as const, collection: COLLECTION_MAP[resource] }
  }

  return { type: 'action' as const, path }
}

// ===== 响应格式转换 =====

function pbRecordToApp(record: any): any {
  const { collectionId, collectionName, created, updated, expand, ...rest } = record
  return {
    ...rest,
    created_at: created || rest.created_at || '',
    updated_at: updated || rest.updated_at || '',
  }
}

function cleanPayload(payload: any): any {
  const { id, ...rest } = payload
  return rest
}

// 全量分页拉取
async function fetchAllRecords(coll: string, { expand = '', sort = '' }: { expand?: string; sort?: string } = {}): Promise<any[]> {
  const all: any[] = []
  let page = 1
  const perPage = 500
  while (true) {
    const params = new URLSearchParams()
    params.set('perPage', String(perPage))
    params.set('page', String(page))
    if (expand) params.set('expand', expand)
    if (sort) params.set('sort', sort)
    const data = await apiRequest(`/api/collections/${coll}/records?${params.toString()}`)
    const items = data.items || []
    for (const it of items) all.push(it)
    const totalPages = data.totalPages || Math.ceil((data.totalItems || 0) / perPage) || 1
    if (page >= totalPages || items.length === 0) break
    page++
  }
  return all
}

// 展平 publish_tasks 的 expand
function flattenTaskExpand(t: any, expand: any): any {
  if (!expand) return t
  if (expand.article_id) {
    const a = expand.article_id
    t.article_title = a.title || ''
    t.article_summary = a.summary || ''
    t.article_body = a.body || ''
    t.article_keywords = a.keywords || ''
    t.article_tags = a.tags || ''
    t.article_image_prompt = a.image_prompt || ''
    t.article_risk_notes = a.risk_notes || ''
    t.product_id = a.product_id || ''
  }
  if (expand.platform_id) {
    const p = expand.platform_id
    t.platform_name = p.name || ''
    t.platform_url = p.url || ''
    t.platform_category = p.category || ''
    t.platform_account_name = p.account_name || ''
    t.platform_login_notes = p.login_notes || ''
  }
  return t
}

// ===== Bootstrap =====

async function apiBootstrap(): Promise<BootstrapData> {
  const [productsRaw, geoRaw, platformsRaw, articlesRaw, tasksRaw, aiRaw, modelsRaw, imagesRaw, checksRaw, skillsRaw] = await Promise.all([
    fetchAllRecords('products', { sort: '-updated_at' }),
    fetchAllRecords('geo_questions', { sort: '-updated_at' }),
    fetchAllRecords('platforms', { sort: 'status,category,name' }),
    fetchAllRecords('articles', { sort: '-updated_at' }),
    fetchAllRecords('publish_tasks', { expand: 'article_id,platform_id', sort: '-updated_at' }),
    fetchAllRecords('ai_settings'),
    fetchAllRecords('user_models'),
    fetchAllRecords('product_images'),
    fetchAllRecords('geo_rank_checks', { sort: '-created_at' }).catch(() => []),
    fetchAllRecords('skills', { sort: 'category,name' }).catch(() => []),
  ])

  const products = productsRaw.map(pbRecordToApp)
  const platforms = platformsRaw.map(pbRecordToApp)
  const articles = articlesRaw.map(pbRecordToApp)

  const geoQuestions = geoRaw.map(r => {
    const q = pbRecordToApp(r)
    const product = products.find((p: any) => String(p.id) === String(q.product_id))
    q.product_name = product ? product.name : ''
    return q
  })

  const tasks = tasksRaw.map(r => flattenTaskExpand(pbRecordToApp(r), r.expand))
  const aiSettings = aiRaw.length > 0 ? pbRecordToApp(aiRaw[0]) : null
  const userModels = modelsRaw.map(pbRecordToApp)
  const productImages = imagesRaw.map(pbRecordToApp)
  const geoRankChecks = checksRaw.map(pbRecordToApp)
  const coverage = apiCoverageInternal(products, geoQuestions, articles, tasks)

  return { products, geo_questions: geoQuestions, platforms, articles, tasks, ai_settings: aiSettings, user_models: userModels, product_images: productImages, geo_rank_checks: geoRankChecks, skills: skillsRaw.map(pbRecordToApp), coverage }
}

// ===== Coverage =====

async function apiCoverage(): Promise<Coverage> {
  const bootstrap = await apiBootstrap()
  return bootstrap.coverage
}

function apiCoverageInternal(products: any[], geoQuestions: any[], articles: any[], tasks: any[]): Coverage {
  const byQuestion = geoQuestions.map(q => {
    const qid = String(q.id)
    const articleCount = articles.filter(a => String(a.geo_question_id) === qid).length
    const publishedCount = tasks.filter(t =>
      t.status === 'published' &&
      articles.some(a => String(a.id) === String(t.article_id) && String(a.geo_question_id) === qid)
    ).length
    return { geo_question_id: q.id, articles: articleCount, published: publishedCount }
  })

  const byProduct = products.map(p => {
    const qs = geoQuestions.filter(q => String(q.product_id) === String(p.id))
    const totalQ = qs.length
    const qidSet = new Set(qs.map(q => String(q.id)))
    let coveredQ = 0, publishedQ = 0
    for (const qid of qidSet) {
      const cov = byQuestion.find(bq => String(bq.geo_question_id) === qid)
      if (cov && cov.articles > 0) coveredQ++
      if (cov && cov.published > 0) publishedQ++
    }
    const rate = totalQ ? Math.round((coveredQ / totalQ) * 1000) / 1000 : 0
    const gaps = qs
      .filter(q => q.status === 'active' && !byQuestion.some(bq => String(bq.geo_question_id) === String(q.id) && bq.articles > 0))
      .map(q => ({ id: q.id, question: q.question, priority: q.priority }))

    return { product_id: p.id, product_name: p.name, total_q: totalQ, covered_q: coveredQ, published_q: publishedQ, rate, gaps }
  })

  const totalQ = byProduct.reduce((s, p) => s + p.total_q, 0)
  const coveredQ = byProduct.reduce((s, p) => s + p.covered_q, 0)
  const highGaps = byProduct.reduce((s, p) => s + p.gaps.filter(g => g.priority === 'high').length, 0)

  return {
    by_question: byQuestion,
    by_product: byProduct,
    summary: {
      total_q: totalQ,
      covered_q: coveredQ,
      rate: totalQ ? Math.round((coveredQ / totalQ) * 1000) / 1000 : 0,
      high_priority_gaps: highGaps,
    },
  }
}

// ===== Assign Tasks =====

async function apiAssignTasks({ article_ids, platform_ids }: { article_ids: string[]; platform_ids: string[] }): Promise<{ created: string[]; skipped: string[] }> {
  const currentTasks = await fetchAllRecords('publish_tasks')
  const created: string[] = []
  const skipped: string[] = []
  const now = new Date().toISOString()
  for (const aid of article_ids) {
    for (const pid of platform_ids) {
      const exists = currentTasks.find(t => t.article_id === String(aid) && t.platform_id === String(pid))
      if (exists) { skipped.push(exists.id); continue }
      const data = await apiRequest('/api/collections/publish_tasks/records', {
        method: 'POST',
        body: {
          article_id: String(aid), platform_id: String(pid), status: 'todo',
          user_id: getCurrentUserId(), created_at: now, updated_at: now,
        },
      })
      created.push(data.id)
    }
  }
  return { created, skipped }
}

// ===== 公开 API =====

export async function geoApi(path: string, options: { method?: string; body?: any } = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase()
  const translated = translatePath(path, method)

  if (translated.type === 'action') {
    switch (path) {
      case '/api/bootstrap': return apiBootstrap()
      case '/api/coverage': return apiCoverage()
      case '/api/backup': return apiBootstrap().then(d => { delete (d as any).coverage; return d })
      case '/api/tasks/assign': return apiAssignTasks(typeof options.body === 'string' ? JSON.parse(options.body) : options.body || {})
      default: throw new ApiError(`未适配的端点：${path}`, 501)
    }
  }

  if (translated.type === 'list') {
    const coll = translated.collection

    if (method === 'GET') {
      const skipSort = coll === 'publish_tasks' || coll === 'ai_settings' || coll === 'user_models' || coll === 'product_images'
      const sort = skipSort ? '' : '-updated_at'
      const expand = coll === 'publish_tasks' ? 'article_id,platform_id' : ''
      const items = await fetchAllRecords(coll, { expand, sort })
      return items.map(pbRecordToApp)
    }

    if (method === 'POST') {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {})
      body.user_id = getCurrentUserId()
      const now = new Date().toISOString()
      if (!body.created_at) body.created_at = now
      if (!body.updated_at) body.updated_at = now
      const data = await apiRequest(`/api/collections/${coll}/records`, {
        method: 'POST',
        body: cleanPayload(body),
      })
      return pbRecordToApp(data)
    }
  }

  if (translated.type === 'record') {
    const { collection, id } = translated

    if (method === 'GET') {
      let queryPath = `/api/collections/${collection}/records/${id}`
      if (collection === 'publish_tasks') queryPath += '?expand=article_id,platform_id'
      const data = await apiRequest(queryPath)
      const rec = pbRecordToApp(data)
      return collection === 'publish_tasks' ? flattenTaskExpand(rec, data.expand) : rec
    }

    if (method === 'PUT' || method === 'PATCH') {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {})
      body.updated_at = new Date().toISOString()
      const data = await apiRequest(`/api/collections/${collection}/records/${id}`, {
        method: 'PATCH',
        body: cleanPayload(body),
      })
      return pbRecordToApp(data)
    }

    if (method === 'DELETE') {
      await apiRequest(`/api/collections/${collection}/records/${id}`, { method: 'DELETE' })
      return { ok: true }
    }
  }

  throw new ApiError(`不支持的请求：${method} ${path}`, 400)
}

export { apiRequest, fetchAllRecords, pbRecordToApp, cleanPayload }
