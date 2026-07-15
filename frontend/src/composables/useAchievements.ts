import { ElNotification } from 'element-plus'
import { useDataStore } from '@/stores/data'

interface Achievement {
  id: string
  icon: string
  name: string
  desc: string
  check: (data: ReturnType<typeof useDataStore>) => boolean
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_product', icon: '📦', name: '初次建档', desc: '创建第一个产品', check: d => d.products.length >= 1 },
  { id: 'first_article', icon: '✍️', name: '处女作', desc: '生成第一篇内容', check: d => d.articles.length >= 1 },
  { id: 'first_publish', icon: '🚀', name: '首发成功', desc: '完成第一次发布', check: d => d.tasks.filter(t => t.status === 'published').length >= 1 },
  { id: 'five_published', icon: '⭐', name: '五步成章', desc: '发布5篇内容', check: d => d.tasks.filter(t => t.status === 'published').length >= 5 },
  { id: 'ten_published', icon: '🏆', name: '十全十美', desc: '发布10篇内容', check: d => d.tasks.filter(t => t.status === 'published').length >= 10 },
  { id: 'three_products', icon: '🎯', name: '多线作战', desc: '管理3个产品', check: d => d.products.length >= 3 },
  {
    id: 'coverage_50', icon: '📊', name: '半壁江山', desc: 'GEO覆盖率达到50%',
    check: d => d.coverage.by_product.some(c => (c.rate || 0) * 100 >= 50),
  },
  {
    id: 'coverage_100', icon: '👑', name: '大满贯', desc: '单个产品GEO覆盖率100%',
    check: d => d.coverage.by_product.some(c => (c.rate || 0) * 100 >= 100),
  },
]

const STORAGE_KEY = 'geo_achievements'

function loadUnlocked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function useAchievements() {
  const data = useDataStore()
  const unlocked = loadUnlocked()

  function checkAchievements() {
    for (const ach of ACHIEVEMENTS) {
      if (!unlocked.has(ach.id) && ach.check(data)) {
        unlocked.add(ach.id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]))
        showPopup(ach)
      }
    }
  }

  function showPopup(ach: Achievement) {
    ElNotification({
      title: '🎉 解锁成就！',
      message: `${ach.icon} ${ach.name}\n${ach.desc}`,
      type: 'success',
      duration: 4000,
      position: 'bottom-right',
    })
  }

  function reset() {
    unlocked.clear()
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    checkAchievements,
    reset,
    achievements: ACHIEVEMENTS,
    unlockedCount: unlocked.size,
  }
}
