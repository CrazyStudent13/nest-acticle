<!-- 全局轻提示：顶部居中，完全复刻 Element message 视觉——类型色浅底 + 实心圆图标 + 同色文字，配合 composables/useToast 使用，挂载在 app.vue -->
<template>
  <Teleport to="body">
    <Transition name="toast-fade" :duration="200">
      <div v-if="state.open" class="global-toast" :class="`type-${state.type}`" :role="state.type === 'error' ? 'alert' : 'status'">
        <!-- 类型图标：类型色实心圆 + 白色符号（error 叉 / success 勾 / warning 叹号 / info·primary i） -->
        <span class="toast-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <circle cx="12" cy="12" r="10" fill="currentColor" />
            <g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="state.type === 'error'">
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </template>
              <template v-else-if="state.type === 'success'">
                <polyline points="8 12.5 11 15.5 16 9.5" />
              </template>
              <template v-else-if="state.type === 'warning'">
                <line x1="12" y1="7" x2="12" y2="13" />
                <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
              </template>
              <template v-else>
                <line x1="12" y1="16" x2="12" y2="11" />
                <line x1="12" y1="7.5" x2="12.01" y2="7.5" />
              </template>
            </g>
          </svg>
        </span>
        <span class="toast-text">{{ state.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const state = useToast()
</script>

<style lang="less" scoped>
.global-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  // 高于一切弹层（登录/注册弹窗遮罩为 1000），保证提示不被遮罩压住
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  pointer-events: none;

  .toast-icon {
    display: flex;
    align-items: center;
  }

  // Element message 配方：实心浅底 + 同色描边 + 类型色文字/图标
  // 不用半透明色：叠在深色遮罩上会发灰
  &.type-error {
    background-color: #fef0f0;
    border-color: #fde2e2;
    color: #f56c6c;
  }

  &.type-warning {
    background-color: #fdf6ec;
    border-color: #faecd8;
    color: #e6a23c;
  }

  &.type-success {
    background-color: #f0f9eb;
    border-color: #e1f3d8;
    color: #67c23a;
  }

  &.type-primary {
    background-color: #ecf5ff;
    border-color: #d9ecff;
    color: #409eff;
  }

  &.type-info {
    background-color: #f4f4f5;
    border-color: #e9e9eb;
    color: #909399;
  }
}

// 深色模式：底色改类型色低透明叠加，文字提亮保证可读
html.dark &.type-error {
  background-color: rgba(241, 106, 106, 0.14);
  border-color: rgba(241, 106, 106, 0.25);
  color: #f16a6a;
}

html.dark &.type-warning {
  background-color: rgba(240, 160, 75, 0.14);
  border-color: rgba(240, 160, 75, 0.25);
  color: #f0a04b;
}

html.dark &.type-success {
  background-color: rgba(94, 201, 126, 0.14);
  border-color: rgba(94, 201, 126, 0.25);
  color: #5ec97e;
}

html.dark &.type-primary {
  background-color: rgba(124, 147, 255, 0.14);
  border-color: rgba(124, 147, 255, 0.25);
  color: #8fa2ff;
}

html.dark &.type-info {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--color-text-2);
}

// 显式 duration（Vue 按 setTimeout 结算，不依赖 transitionend）
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
