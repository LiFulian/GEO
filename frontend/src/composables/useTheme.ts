import { ref } from 'vue'

const isDark = ref(false)

export function useTheme() {
  function initTheme() {
    const saved = localStorage.getItem('geo_theme')
    isDark.value = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
    applyTheme()
  }

  function applyTheme() {
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('geo_theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  return { isDark, initTheme, toggleTheme }
}
