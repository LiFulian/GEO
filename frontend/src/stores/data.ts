import { defineStore } from 'pinia'
import { ref } from 'vue'
import { geoApi } from '@/api/client'
import { useAuthStore } from './auth'
import type { Product, Platform, Article, PublishTask, GeoQuestion, ProductImage, GeoRankCheck, Coverage, BootstrapData, Skill } from '@/types'

// 默认 AI 预设
export const AI_PRESETS = [
  { name: '智谱 GLM-4.7 Flash（免费）', text_base_url: 'https://open.bigmodel.cn/api/paas/v4', text_model: 'glm-4.7-flash', image_base_url: 'https://open.bigmodel.cn/api/paas/v4', image_model: 'cogview-3-flash', provider: '智谱AI' },
  { name: '智谱 GLM-4 Flash（免费）', text_base_url: 'https://open.bigmodel.cn/api/paas/v4', text_model: 'glm-4-flash', image_base_url: 'https://open.bigmodel.cn/api/paas/v4', image_model: 'cogview-3-flash', provider: '智谱AI' },
  { name: '智谱 GLM-4.6V Flash（免费，多模态）', text_base_url: 'https://open.bigmodel.cn/api/paas/v4', text_model: 'glm-4.6v-flash', image_base_url: 'https://open.bigmodel.cn/api/paas/v4', image_model: 'cogview-3-flash', provider: '智谱AI' },
  { name: 'OpenAI Compatible', text_base_url: 'https://api.openai.com/v1', text_model: 'gpt-4.1-mini', image_base_url: 'https://api.openai.com/v1', image_model: 'gpt-image-1', provider: 'OpenAI' },
  { name: 'DeepSeek 文本', text_base_url: 'https://api.deepseek.com/v1', text_model: 'deepseek-chat', image_base_url: '', image_model: '', provider: 'DeepSeek' },
  { name: '豆包 Ark 文本', text_base_url: 'https://ark.cn-beijing.volces.com/api/v3', text_model: '请填写你的 endpoint id', image_base_url: '', image_model: '', provider: '字节跳动' },
  { name: '通义千问兼容', text_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', text_model: 'qwen-plus', image_base_url: '', image_model: '', provider: '阿里云' },
  { name: '本地 Ollama 网关', text_base_url: 'http://127.0.0.1:11434/v1', text_model: 'qwen2.5:7b', image_base_url: '', image_model: '', provider: '本地部署' },
]

const _envDefaultKey = (typeof window !== 'undefined' && window.__GEO_ENV__ && window.__GEO_ENV__.VITE_DEFAULT_AI_KEY) || ''
export const DEFAULT_AI_SETTINGS = {
  mode: _envDefaultKey ? 'api' : 'manual',
  text_base_url: 'https://open.bigmodel.cn/api/paas/v4',
  text_model: 'glm-4.7-flash',
  image_base_url: 'https://open.bigmodel.cn/api/paas/v4',
  image_model: 'cogview-3-flash',
  temperature: 0.7,
  preset_index: 0,
}

// 默认平台种子数据
const DEFAULT_PLATFORMS = [
  { name: '微信公众号', category: '综合资讯', url: 'https://mp.weixin.qq.com', content_style: '深度长文，标题吸睛，开头留人', recommended_words: '800-2000', title_style: '悬念/数字/痛点', tags_rule: '无需标签', allows_external_links: 'limited', soft_article_fit: 'high', frequency: '每周2-3篇', status: 'enabled', notes: '需公众号后台发布，支持图文/视频' },
  { name: '今日头条', category: '综合资讯', url: 'https://www.toutiao.com', content_style: '信息量大，标题党友好', recommended_words: '1000-2500', title_style: '数字/疑问/对比', tags_rule: '3-5个话题标签', allows_external_links: 'limited', soft_article_fit: 'high', frequency: '每日1篇', status: 'enabled', notes: '头条号后台发布，推荐算法分发' },
  { name: '百家号', category: '综合资讯', url: 'https://baijiahao.baidu.com', content_style: '权威严谨，SEO友好', recommended_words: '1000-2000', title_style: '关键词前置', tags_rule: '3-5个标签', allows_external_links: 'limited', soft_article_fit: 'medium', frequency: '每周2-3篇', status: 'enabled', notes: '百度系流量，搜索收录好' },
  { name: '企鹅号', category: '综合资讯', url: 'https://om.qq.com', content_style: '腾讯系分发，内容多元', recommended_words: '800-2000', title_style: '直接/信息型', tags_rule: '3-5个标签', allows_external_links: 'limited', soft_article_fit: 'medium', frequency: '每周2篇', status: 'watch', notes: '腾讯内容开放平台' },
  { name: '网易号', category: '综合资讯', url: 'https://mp.163.com', content_style: '新闻资讯向', recommended_words: '800-1500', title_style: '新闻式标题', tags_rule: '3个标签', allows_external_links: 'limited', soft_article_fit: 'medium', frequency: '每周1-2篇', status: 'watch', notes: '网易号后台发布' },
  { name: '知乎', category: '社区社交', url: 'https://www.zhihu.com', content_style: '专业深度，回答式，GEO/SEO 收录强', recommended_words: '1500-4000', title_style: '问题式/干货型', tags_rule: '5个话题', allows_external_links: 'limited', soft_article_fit: 'high', frequency: '每周2-3篇', status: 'enabled', notes: '知乎专栏/回答，AI 引用率高' },
  { name: '小红书', category: '社区社交', url: 'https://www.xiaohongshu.com', content_style: '种草口语化，emoji 多，图文并茂', recommended_words: '300-800', title_style: '情绪/场景/数字', tags_rule: '5-10个话题标签', allows_external_links: 'forbidden', soft_article_fit: 'high', frequency: '每周3-5篇', status: 'enabled', notes: '需 App 发布，图片必备' },
  { name: '微博', category: '社区社交', url: 'https://weibo.com', content_style: '短平快，话题性强', recommended_words: '140-500', title_style: '话题/热点', tags_rule: '#话题# 格式', allows_external_links: 'allowed', soft_article_fit: 'medium', frequency: '每日1-2条', status: 'enabled', notes: '微博开放平台发布' },
  { name: '豆瓣', category: '社区社交', url: 'https://www.douban.com', content_style: '文艺深度，长评友好', recommended_words: '800-2000', title_style: '感悟式', tags_rule: '无需标签', allows_external_links: 'limited', soft_article_fit: 'low', frequency: '每周1篇', status: 'watch', notes: '豆瓣日记/小组' },
  { name: '抖音', category: '视频平台', url: 'https://www.douyin.com', content_style: '短视频脚本，前3秒抓人', recommended_words: '脚本200-500字 / 视频1-3分钟', title_style: '悬念/冲突', tags_rule: '#话题 标签', allows_external_links: 'forbidden', soft_article_fit: 'high', frequency: '每周3-5条', status: 'enabled', notes: '抖音创作者中心发布' },
  { name: '快手', category: '视频平台', url: 'https://www.kuaishou.com', content_style: '接地气，老铁文化', recommended_words: '脚本200-400字 / 视频1-2分钟', title_style: '生活化', tags_rule: '#话题 标签', allows_external_links: 'forbidden', soft_article_fit: 'medium', frequency: '每周3-5条', status: 'watch', notes: '快手创作者后台' },
  { name: 'B站', category: '视频平台', url: 'https://www.bilibili.com', content_style: '中长视频，知识/趣味并重', recommended_words: '脚本800-2000字 / 视频5-15分钟', title_style: 'UP主风格', tags_rule: '5-10个标签', allows_external_links: 'allowed', soft_article_fit: 'high', frequency: '每周1-2条', status: 'enabled', notes: 'B站创作中心上传' },
  { name: '视频号', category: '视频平台', url: 'https://channels.weixin.qq.com', content_style: '社交分发，内容偏生活/知识', recommended_words: '脚本200-600字 / 视频1-5分钟', title_style: '温情/干货', tags_rule: '#话题 标签', allows_external_links: 'limited', soft_article_fit: 'medium', frequency: '每周2-3条', status: 'watch', notes: '微信视频号助手' },
  { name: '掘金', category: '技术社区', url: 'https://juejin.cn', content_style: '技术干货，代码示例多', recommended_words: '1500-5000', title_style: '技术关键词+痛点', tags_rule: '1-3个标签', allows_external_links: 'allowed', soft_article_fit: 'high', frequency: '每周1-2篇', status: 'enabled', notes: '技术产品向内容友好' },
  { name: 'CSDN', category: '技术社区', url: 'https://www.csdn.net', content_style: '技术教程，SEO 收录强', recommended_words: '1000-3000', title_style: '教程式标题', tags_rule: '3-5个标签', allows_external_links: 'allowed', soft_article_fit: 'high', frequency: '每周1-2篇', status: 'enabled', notes: '百度收录好，适合 SEO' },
  { name: '博客园', category: '技术社区', url: 'https://www.cnblogs.com', content_style: '技术博客，深度文章', recommended_words: '1000-3000', title_style: '技术型', tags_rule: '分类标签', allows_external_links: 'allowed', soft_article_fit: 'medium', frequency: '每周1篇', status: 'watch', notes: '老牌技术社区' },
  { name: '思否', category: '技术社区', url: 'https://segmentfault.com', content_style: '技术问答+专栏', recommended_words: '800-2000', title_style: '问题/教程式', tags_rule: '1-3个标签', allows_external_links: 'allowed', soft_article_fit: 'medium', frequency: '每周1篇', status: 'watch', notes: 'SegmentFault' },
  { name: 'Medium', category: '海外平台', url: 'https://medium.com', content_style: '英文长文，故事化', recommended_words: '1500-3000', title_style: '英文标题', tags_rule: '5个标签', allows_external_links: 'allowed', soft_article_fit: 'high', frequency: '每周1篇', status: 'watch', notes: '海外受众' },
  { name: 'WordPress', category: '海外平台', url: 'https://wordpress.com', content_style: '独立站博客，完全自主', recommended_words: '1000-2500', title_style: 'SEO 关键词', tags_rule: '分类+标签', allows_external_links: 'allowed', soft_article_fit: 'high', frequency: '每周1-2篇', status: 'watch', notes: '自建站，SEO 友好' },
]

// 默认 Skill 种子数据
const DEFAULT_SKILLS: Omit<Skill, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: '头脑风暴',
    description: '从零开始发散创意，帮你挖掘有潜力的产品方向',
    category: '创意',
    is_preset: true,
    content: `# 头脑风暴工作法

## 核心原则
1. **数量优先**：先追求数量，质量自然会来
2. **不批评**：任何想法都值得被记录
3. **搭便车**：在别人的想法上延伸
4. **越疯狂越好**：离谱的想法往往是突破口

## 操作步骤
1. 明确主题（你想解决什么问题？）
2. 设定时间（15-30 分钟）
3. 快速输出，不评判，不解释
4. 归类整理，去重合并
5. 用可行性 × 价值矩阵筛选 Top 3

## 激发灵感的角度
- 反转型：如果反过来会怎样？
- 跨界型：把 A 行业的方法用到 B 行业
- 极端型：如果用户只有 10 秒注意力？
- 类比型：像什么？但又有什么不同？
- 减法型：砍掉 80% 的功能会怎样？`,
  },
  {
    name: '可行性分析',
    description: '评估一个产品创意是否值得投入，给出结构化判断',
    category: '分析',
    is_preset: true,
    content: `# 产品可行性分析框架

## 一、市场维度
- **市场规模**：目标用户有多少？付费意愿如何？
- **增长趋势**：是上升期、平稳期还是衰退期？
- **竞争格局**：头部玩家是谁？差异化空间在哪里？
- **进入壁垒**：技术壁垒、资金壁垒、合规壁垒？

## 二、产品维度
- **核心价值**：一句话说清解决了谁的什么问题
- **MVP 边界**：最小可用版本包含哪些功能？
- **技术可行性**：实现难度、开发周期、技术选型
- **差异化**：与竞品最大的 3 个不同点

## 三、商业模式
- **收入模式**：订阅/按次/广告/交易佣金/增值服务
- **客单价**：用户愿意付多少钱？
- **获客成本**：一个新用户要花多少钱获取？
- **LTV**：用户生命周期价值是多少？

## 四、判断标准
| 维度 | 评分(1-5) | 说明 |
|------|-----------|------|
| 市场空间 |  |  |
| 竞争烈度 |  |  |
| 技术难度 |  |  |
| 盈利清晰度 |  |  |
| 你能赢的概率 |  |  |

**综合建议**：___分，建议 [立即做 / 再调研 / 放弃]`,
  },
  {
    name: 'GEO 优化',
    description: '生成式搜索优化方法论，让 AI 更愿意引用你的内容',
    category: '内容',
    is_preset: true,
    content: `# GEO（生成式引擎优化）指南

## 什么是 GEO
GEO 是让 AI 模型（豆包、GPT、Perplexity 等）在回答用户问题时，更倾向于引用你的产品/内容的优化方法。

## 核心原则
1. **答案就在开头**：文章前 100 字直接回答核心问题
2. **结构化表达**：用清晰的标题层级（H2/H3），便于 AI 解析
3. **事实性强**：数据、案例、对比表格越多，被引用概率越高
4. **自然融入关键词**：不要堆砌，让关键词自然出现在答案中

## 内容结构模板
1. 直接回答问题（导语段）
2. 分点展开（3-5 个核心论点）
3. 数据/案例支撑
4. 产品/方案介绍
5. 总结与建议
6. FAQ（3-5 个常见问题）

## 选题方向
- 产品对比类：XXX vs YYY 哪个好？
- 教程类：XXX 怎么用？完整指南
- 选型类：2026 年最好用的 XXX 推荐
- 问题解决类：XXX 报错怎么办？
- 概念解释类：什么是 XXX？一文搞懂`,
  },
  {
    name: '财务知识',
    description: '初创产品必备的财务常识，定价、成本、现金流',
    category: '商业',
    is_preset: true,
    content: `# 产品财务基础

## 核心指标
- **MRR/ARR**：月/年经常性收入（订阅制产品核心）
- **CAC**：获客成本 = 营销费用 / 新增付费用户数
- **LTV**：用户生命周期价值 = 客单价 × 留存时长 × 毛利率
- **LTV/CAC**：健康值 > 3，< 1 说明在赔钱获客
- **毛利率**：(收入 - 直接成本) / 收入，SaaS 通常 > 70%
- **流失率**：月流失 < 2% 算健康

## 定价方法
1. **成本加成**：成本 × (1 + 毛利率) — 简单但可能错估价值
2. **竞品对标**：参考竞品定价，找差异化定位
3. **价值定价**：按用户获得的价值收费 — 最优但难量化
4. **免费增值**：基础免费，高级付费 — 互联网产品主流

## 现金流红线
- 账上现金 ≥ 12 个月运营成本（安全线）
- 6-12 个月：预警，开始节流
- < 6 个月：紧急，必须融资或增收

## 单位经济学验证
在大规模投入前，先验证一个用户能否赚钱：
1. 一个用户能收多少钱？
2. 获取这个用户花了多少钱？
3. 服务这个用户的边际成本？
4. 这个用户会待多久？`,
  },
  {
    name: '随机产品生成器',
    description: '随机生成产品创意，打破思维定式，激发灵感',
    category: '创意',
    is_preset: true,
    content: `# 随机产品生成器

## 玩法
用下面的公式随机组合，生成 10 个"荒诞但可能有用"的产品创意，然后挑 1-2 个认真分析可行性。

## 组合公式
**[目标人群] + [场景] + [痛点] + [AI 能力] = 新产品**

### 目标人群随机池
- 独立开发者
- 小红书博主
- 中小企业老板
- 在校大学生
- 自由职业者
- 新手爸妈
- 远程工作者
- 考研党
- 宠物主人
- 健身爱好者

### 场景随机池
- 早上通勤路上
- 深夜加班时
- 周末休闲时
- 做决策前
- 学习新技能时
- 管理团队时
- 写东西时
- 找东西时
- 算账时
- 无聊摸鱼时

### 痛点随机池
- 信息太多看不过来
- 不知道怎么开始
- 坚持不下去
- 怕做错决定
- 太贵了
- 太麻烦了
- 没人一起
- 记不住
- 找不到好用的工具
- 效果不好衡量

### AI 能力随机池
- 自然语言理解
- 图像生成
- 数据分析
- 对话式交互
- 自动总结
- 多语言翻译
- 智能推荐
- 语音合成
- 代码生成
- 知识库问答

## 练习
随机组合 10 个，每个写一句话描述，然后给每个打分：
- 你自己会用吗？（1-5分）
- 别人愿意付钱吗？（1-5分）
- 实现难度大吗？（1-5分，越低越好）

最高分的那个，认真写一份可行性分析。`,
  },
]

export const useDataStore = defineStore('data', () => {
  const products = ref<Product[]>([])
  const geo_questions = ref<GeoQuestion[]>([])
  const platforms = ref<Platform[]>([])
  const articles = ref<Article[]>([])
  const tasks = ref<PublishTask[]>([])
  const ai_settings = ref<any>({})
  const user_models = ref<any[]>([])
  const product_images = ref<ProductImage[]>([])
  const geo_rank_checks = ref<GeoRankCheck[]>([])
  const skills = ref<Skill[]>([])
  const coverage = ref<Coverage>({
    by_question: [],
    by_product: [],
    summary: { total_q: 0, covered_q: 0, rate: 0, high_priority_gaps: 0 },
  })

  let _loaded = false

  async function load() {
    const data: BootstrapData = await geoApi('/api/bootstrap')
    products.value = data.products
    geo_questions.value = data.geo_questions
    platforms.value = data.platforms
    articles.value = data.articles
    tasks.value = data.tasks
    ai_settings.value = data.ai_settings || {}
    user_models.value = data.user_models
    product_images.value = data.product_images
    geo_rank_checks.value = data.geo_rank_checks
    skills.value = data.skills || []
    coverage.value = data.coverage

    const auth = useAuthStore()
    if (!auth.loggedIn) return

    // 首次加载若平台为空，自动播种
    if (platforms.value.length === 0) {
      const seeded = await seedDefaultPlatforms()
      if (seeded) platforms.value = seeded
    }

    // 首次加载若无 AI 设置，自动创建
    if (!ai_settings.value || !ai_settings.value.id) {
      await seedDefaultAiSettings()
    }

    // 首次加载若无 Skill，自动播种预设
    if (skills.value.length === 0) {
      const seeded = await seedDefaultSkills()
      if (seeded) skills.value = seeded
    }

    _loaded = true
  }

  async function seedDefaultPlatforms(): Promise<Platform[] | null> {
    try {
      const created = await Promise.all(DEFAULT_PLATFORMS.map(p =>
        geoApi('/api/platforms', { method: 'POST', body: p })
      ))
      return created
    } catch {
      return null
    }
  }

  async function seedDefaultAiSettings() {
    try {
      const payload: any = { ...DEFAULT_AI_SETTINGS }
      if (_envDefaultKey) {
        payload.text_api_key = _envDefaultKey
        payload.image_api_key = _envDefaultKey
        payload.mode = 'api'
      }
      const created = await geoApi('/api/ai_settings', { method: 'POST', body: payload })
      if (created) ai_settings.value = created
    } catch {
      // 忽略
    }
  }

  async function seedDefaultSkills(): Promise<Skill[] | null> {
    try {
      const created = await Promise.all(DEFAULT_SKILLS.map(s =>
        geoApi('/api/skills', { method: 'POST', body: s })
      ))
      return created
    } catch {
      return null
    }
  }

  function clear() {
    products.value = []
    geo_questions.value = []
    platforms.value = []
    articles.value = []
    tasks.value = []
    ai_settings.value = {}
    user_models.value = []
    product_images.value = []
    geo_rank_checks.value = []
    skills.value = []
    coverage.value = { by_question: [], by_product: [], summary: { total_q: 0, covered_q: 0, rate: 0, high_priority_gaps: 0 } }
    _loaded = false
  }

  return {
    products, geo_questions, platforms, articles, tasks, ai_settings, user_models,
    product_images, geo_rank_checks, skills, coverage,
    load, clear, seedDefaultPlatforms, seedDefaultAiSettings, seedDefaultSkills,
    get isLoaded() { return _loaded },
  }
})
