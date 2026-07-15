<template>
  <div class="fatal-error-overlay">
    <el-card class="fatal-card">
      <div class="fatal-icon">⚠️</div>
      <h2>数据加载失败</h2>
      <p class="muted">{{ message }}</p>
      <p class="hint muted">请确认后端已启动：<code>bash run.sh status</code></p>
      <el-button type="primary" @click="$emit('retry')">重试</el-button>
    </el-card>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<style scoped>
.fatal-error-overlay {
  position: fixed;
  inset: 0;
  background: var(--geo-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.fatal-card {
  text-align: center;
  padding: 32px;
  max-width: 400px;
}

.fatal-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.muted {
  color: var(--el-text-color-secondary);
}

.hint {
  font-size: 12px;
  margin: 8px 0 16px;
}

code {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
