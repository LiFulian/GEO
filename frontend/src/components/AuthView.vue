<template>
  <div class="auth-overlay">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 L4 7 L4 17 L12 22 L20 17 L20 7 Z" />
            <path d="M12 2 L12 22 M4 7 L20 17 M20 7 L4 17" />
          </svg>
        </div>
        <strong>GEO Studio</strong>
      </div>
      <el-tabs v-model="activeTab" class="auth-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form @submit.prevent="handleLogin" label-position="top">
            <el-form-item label="邮箱">
              <el-input v-model="loginForm.email" type="email" placeholder="your@email.com" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="loginForm.password" type="password" placeholder="至少 8 位" show-password />
            </el-form-item>
            <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">登录</el-button>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="注册" name="register">
          <el-form @submit.prevent="handleRegister" label-position="top">
            <el-form-item label="昵称">
              <el-input v-model="regForm.name" placeholder="可选" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="regForm.email" type="email" placeholder="your@email.com" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="regForm.password" type="password" placeholder="至少 8 位" show-password />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input v-model="regForm.passwordConfirm" type="password" placeholder="再次输入密码" show-password />
            </el-form-item>
            <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">注册</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <div class="account-chips">
        <p class="muted small-center">快速选择测试账号</p>
        <div class="chips">
          <el-tag
            v-for="i in 5"
            :key="i"
            class="chip"
            @click="selectAccount(i)"
            effect="plain"
          >
            user{{ String(i).padStart(3, '0') }}
          </el-tag>
        </div>
      </div>
      <p class="auth-footer muted">数据仅本地存储 · 私人工具</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDataStore } from '@/stores/data'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const auth = useAuthStore()
const data = useDataStore()
const { success, error: showError } = useToast()

const activeTab = ref('login')
const loading = ref(false)

const loginForm = reactive({ email: '', password: '' })
const regForm = reactive({ name: '', email: '', password: '', passwordConfirm: '' })

function selectAccount(i: number) {
  loginForm.email = `user${String(i).padStart(3, '0')}@geo.local`
  loginForm.password = 'test1234'
  activeTab.value = 'login'
}

async function handleLogin() {
  loading.value = true
  try {
    await auth.login(loginForm.email, loginForm.password)
    await data.load()
    success('登录成功')
    router.push('/dashboard')
  } catch (e: any) {
    showError(e.message)
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (regForm.password !== regForm.passwordConfirm) {
    showError('两次密码不一致')
    return
  }
  loading.value = true
  try {
    await auth.register(regForm.email, regForm.password, regForm.name)
    await data.load()
    success('注册成功，欢迎！')
    router.push('/dashboard')
  } catch (e: any) {
    showError(e.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  background: var(--geo-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.auth-card {
  width: 400px;
  max-width: 90vw;
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
}

.auth-brand strong {
  font-size: 20px;
}

.account-chips {
  margin-top: 16px;
  text-align: center;
}

.chips {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 8px;
}

.chip {
  cursor: pointer;
}

.auth-footer {
  text-align: center;
  margin-top: 16px;
  font-size: 12px;
}

.muted {
  color: var(--el-text-color-secondary);
}

.small-center {
  font-size: 12px;
  margin: 0;
}
</style>
