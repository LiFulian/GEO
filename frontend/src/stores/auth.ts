import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { userLogin, userRegister, logout as apiLogout, isLoggedIn, getCurrentUserId, getCurrentUserEmail, getCurrentUserName, getCurrentUserRecord } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(isLoggedIn())
  const user = ref(getCurrentUserRecord())

  const userId = computed(() => getCurrentUserId())
  const userEmail = computed(() => getCurrentUserEmail())
  const userName = computed(() => getCurrentUserName())

  async function login(email: string, password: string) {
    const record = await userLogin(email, password)
    loggedIn.value = true
    user.value = record
    return record
  }

  async function register(email: string, password: string, name?: string) {
    const record = await userRegister(email, password, name)
    loggedIn.value = true
    user.value = record
    return record
  }

  function logout() {
    apiLogout()
    loggedIn.value = false
    user.value = null
  }

  function refresh() {
    loggedIn.value = isLoggedIn()
    user.value = getCurrentUserRecord()
  }

  return { loggedIn, user, userId, userEmail, userName, login, register, logout, refresh }
})
