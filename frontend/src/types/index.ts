// ===== 业务类型定义 =====

export type ProductStatus = 'active' | 'draft' | 'paused' | 'archived'
export type ArticleStatus = 'draft' | 'review' | 'approved' | 'archived'
export type PlatformStatus = 'enabled' | 'watch' | 'disabled'
export type TaskStatus = 'todo' | 'published' | 'revise' | 'skipped'
export type GeoQuestionStatus = 'active' | 'covered' | 'paused'
export type Priority = 'high' | 'medium' | 'low'
export type AiMode = 'manual' | 'api'

export interface Product {
  id: string
  user_id: string
  name: string
  type: string
  url: string
  audience: string
  selling_points: string
  competitors: string
  tone: string
  goal: string
  forbidden_words: string
  status: ProductStatus
  deep_content?: string
  created_at: string
  updated_at: string
}

export interface GeoQuestion {
  id: string
  user_id: string
  product_id: string
  question: string
  intent: string
  audience: string
  content_angle: string
  priority: Priority
  status: GeoQuestionStatus
  product_name?: string
  created_at: string
  updated_at: string
}

export interface Platform {
  id: string
  user_id: string
  name: string
  category: string
  url: string
  content_style: string
  recommended_words: string
  title_style: string
  tags_rule: string
  allows_external_links: 'allowed' | 'limited' | 'forbidden'
  soft_article_fit: 'high' | 'medium' | 'low'
  frequency: string
  status: PlatformStatus
  notes: string
  account_name?: string
  login_notes?: string
  created_at: string
  updated_at: string
}

export interface Article {
  id: string
  user_id: string
  product_id: string
  geo_question_id?: string
  title: string
  body: string
  summary: string
  content_type: string
  target_platform: string
  keywords: string
  tags: string
  image_prompt: string
  risk_notes: string
  status: ArticleStatus
  quality_score?: number
  created_at: string
  updated_at: string
}

export interface PublishTask {
  id: string
  user_id: string
  article_id: string
  platform_id: string
  status: TaskStatus
  publish_url: string
  notes: string
  scheduled_date: string
  created_at: string
  updated_at: string
  // expand 展平字段
  article_title?: string
  article_summary?: string
  article_body?: string
  article_keywords?: string
  article_tags?: string
  article_image_prompt?: string
  article_risk_notes?: string
  product_id?: string
  platform_name?: string
  platform_url?: string
  platform_category?: string
  platform_account_name?: string
  platform_login_notes?: string
}

export interface AiSettings {
  id: string
  user_id: string
  mode: AiMode
  text_base_url: string
  text_model: string
  text_api_key: string
  image_base_url: string
  image_model: string
  image_api_key: string
  temperature: number
  preset_index: number
  created_at: string
  updated_at: string
}

export interface UserModel {
  id: string
  user_id: string
  name: string
  base_url: string
  model: string
  api_key: string
  provider: string
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  user_id: string
  product_id: string
  image: string
  caption: string
  created_at: string
  updated_at: string
}

export interface GeoRankCheck {
  id: string
  user_id: string
  product_id: string
  question_id: string
  question: string
  engine: string
  cited: boolean
  citation_snippet: string
  checked_at: string
  created_at: string
  updated_at: string
}

export interface CoverageByQuestion {
  geo_question_id: string
  articles: number
  published: number
}

export interface CoverageByProduct {
  product_id: string
  product_name: string
  total_q: number
  covered_q: number
  published_q: number
  rate: number
  gaps: { id: string; question: string; priority: Priority }[]
}

export interface CoverageSummary {
  total_q: number
  covered_q: number
  rate: number
  high_priority_gaps: number
}

export interface Coverage {
  by_question: CoverageByQuestion[]
  by_product: CoverageByProduct[]
  summary: CoverageSummary
}

export interface BootstrapData {
  products: Product[]
  geo_questions: GeoQuestion[]
  platforms: Platform[]
  articles: Article[]
  tasks: PublishTask[]
  ai_settings: AiSettings | null
  user_models: UserModel[]
  product_images: ProductImage[]
  geo_rank_checks: GeoRankCheck[]
  skills: Skill[]
  coverage: Coverage
}

export interface Skill {
  id: string
  user_id: string
  name: string
  description: string
  category: string
  content: string
  is_preset: boolean
  created_at: string
  updated_at: string
}

// AI 预设
export interface AiPreset {
  name: string
  text_base_url: string
  text_model: string
  image_base_url: string
  image_model: string
  provider: string
}

// API 响应
export interface ApiResult<T = any> {
  ok?: boolean
  data?: T
  [key: string]: any
}
