<template>
  <aside class="app-sidebar">
    <div class="sidebar-brand">
      <div class="brand-mark">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2 L4 7 L4 17 L12 22 L20 17 L20 7 Z" />
          <path d="M12 2 L12 22 M4 7 L20 17 M20 7 L4 17" />
        </svg>
      </div>
      <div class="brand-text">
        <strong>GEO Studio</strong>
      </div>
    </div>
    <el-menu :default-active="activeRoute" @select="handleSelect" class="sidebar-menu">
      <el-menu-item index="dashboard">
        <el-icon><Odometer /></el-icon>
        <span>总览</span>
      </el-menu-item>
      <el-menu-item-group title="资产">
        <el-menu-item index="products">
          <el-icon><Box /></el-icon>
          <span>产品档案</span>
        </el-menu-item>
        <el-menu-item index="platforms">
          <el-icon><Grid /></el-icon>
          <span>发布平台</span>
        </el-menu-item>
      </el-menu-item-group>
      <el-menu-item-group title="内容">
        <el-menu-item index="workshop">
          <el-icon><EditPen /></el-icon>
          <span>内容工坊</span>
        </el-menu-item>
      </el-menu-item-group>
      <el-menu-item-group title="执行">
        <el-menu-item index="tasks">
          <el-icon><Calendar /></el-icon>
          <span>发布记录</span>
        </el-menu-item>
      </el-menu-item-group>
      <el-menu-item-group title="设置">
        <el-menu-item index="settings">
          <el-icon><Setting /></el-icon>
          <span>AI 设置</span>
        </el-menu-item>
      </el-menu-item-group>
    </el-menu>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const activeRoute = computed(() => {
  const path = route.path.split('/')[1] || 'dashboard'
  return path
})

function handleSelect(index: string) {
  router.push({ name: index })
}
</script>

<style scoped>
.app-sidebar {
  width: 210px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-right: 1px solid var(--geo-border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-shadow: 1px 0 3px rgba(15, 23, 42, 0.03);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 16px;
  border-bottom: 1px solid var(--geo-border-light);
  position: relative;
}

.sidebar-brand::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 18px;
  right: 18px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--geo-border), transparent);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-text strong {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.3px;
  background: linear-gradient(135deg, var(--geo-brand), var(--geo-brand-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sidebar-menu {
  flex: 1;
  padding: 8px 10px;
  overflow-y: auto;
}

/* 紧凑菜单项 */
.sidebar-menu :deep(.el-menu-item) {
  height: 38px;
  line-height: 38px;
  font-size: 13px;
  border-radius: var(--geo-radius);
  margin: 2px 0;
  padding-left: 12px !important;
  position: relative;
  transition: all var(--geo-transition);
  overflow: hidden;
}

.sidebar-menu :deep(.el-menu-item::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 18px;
  background: var(--geo-brand);
  border-radius: 0 2px 2px 0;
  transition: transform var(--geo-transition-slow);
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background: var(--el-fill-color-light);
  transform: translateX(2px);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background: var(--geo-brand-bg);
  color: var(--geo-brand-dark);
  font-weight: 500;
  transform: translateX(0);
}

.sidebar-menu :deep(.el-menu-item.is-active::before) {
  transform: translateY(-50%) scaleY(1);
}

.sidebar-menu :deep(.el-menu-item.is-active .el-icon) {
  color: var(--geo-brand);
}

.sidebar-menu :deep(.el-menu-item-group__title) {
  font-size: 11px;
  color: var(--geo-text-light);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 14px 12px 6px;
  font-weight: 600;
}
</style>
