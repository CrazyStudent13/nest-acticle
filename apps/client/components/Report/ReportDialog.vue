<!-- 举报弹窗：文章/用户举报共用（targetType 决定文案），理由选项走字典 post_report_reason 懒加载（弹窗挂载即登录态，满足 useDict 登录守卫）；补充说明可空；提交成功 emit('done') 由挂点回写「已举报」置灰态。同一目标同时至多一条待处理举报，重复提交由服务端唯一索引拒绝并在弹窗内提示 -->
<template>
  <Teleport to="body">
    <div class="report-overlay" @click.self="emit('close')">
      <div class="report-modal">
        <div class="modal-head">
          <h2>{{ targetType === 'user' ? '举报用户' : '举报文章' }}</h2>
          <button class="modal-close" type="button" @click="emit('close')">×</button>
        </div>

        <p v-if="targetLabel" class="report-target">{{ targetType === 'user' ? '被举报用户' : '被举报内容' }}：{{ targetLabel }}</p>

        <div class="report-row">
          <span class="row-label">举报理由</span>
          <div class="reason-grid">
            <template v-if="reasonOptions.length">
              <button
                v-for="opt in reasonOptions"
                :key="opt.dictValue"
                class="reason-pill"
                :class="{ active: form.reasonType === opt.dictValue }"
                type="button"
                @click="form.reasonType = opt.dictValue"
              >
                {{ opt.dictLabel }}
              </button>
            </template>
            <span v-else class="reason-loading">理由加载中…</span>
          </div>
        </div>

        <div class="report-row">
          <span class="row-label">补充说明</span>
          <span class="row-field">
            <textarea
              v-model="form.reasonContent"
              class="form-textarea"
              rows="3"
              maxlength="500"
              :placeholder="reasonPlaceholder"
            />
            <span class="char-count" :class="{ over: form.reasonContent.length >= 500 }">{{ form.reasonContent.length }}/500</span>
          </span>
        </div>

        <p v-if="tip" class="form-tip tip-error">{{ tip }}</p>

        <div class="modal-actions">
          <button class="btn ghost" type="button" @click="emit('close')">取消</button>
          <button class="btn primary" type="button" :disabled="submitting" @click="confirmSubmit">
            {{ submitting ? '提交中…' : '提交举报' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { ReportTargetType } from '@nest-acticle/shared'

const props = defineProps<{
  /** 举报目标类型：post 文章 / user 用户（字典 post_report_target 的取值） */
  targetType: ReportTargetType
  /** 举报目标 id（文章 id / 用户 id） */
  targetId: number | string
  /** 目标展示文案（文章标题 / 用户昵称），缺省不显示上下文行 */
  targetLabel?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'done'): void
}>()

// 理由选项走字典（运营可在管理端扩理由，前端不写死）；弹窗 v-if 挂载即已登录，满足登录守卫
const reasonOptions = useDict('post_report_reason')
const { submitReport } = useReport()

const form = reactive({ reasonType: '', reasonContent: '' })
const tip = ref('')
const submitting = ref(false)

// placeholder 联动所选理由：短提示即可（抄袭需要出处链接，其余统一「可选」）
const reasonPlaceholder = computed(() => {
  if (form.reasonType === 'plagiarism') {
    return '可粘贴原文出处链接'
  }
  return '补充说明（可选）'
})

const confirmSubmit = async () => {
  if (!form.reasonType) {
    tip.value = '请选择举报理由'
    return
  }
  if (form.reasonContent.length > 500) {
    tip.value = '补充说明不能超过 500 字'
    return
  }
  submitting.value = true
  tip.value = ''
  try {
    await submitReport({
      targetType: props.targetType,
      targetId: props.targetId,
      reasonType: form.reasonType,
      reasonContent: form.reasonContent.trim() || undefined
    })
    emit('done')
  } catch (error: any) {
    // 重复举报/频控等业务错误在弹窗内提示（服务端唯一索引兜底），不打断填写现场
    tip.value = error?.message || '提交失败，请稍后再试'
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="less" scoped>
// 与收藏集弹窗同款骨架：居中卡片 + 遮罩点击关闭
.report-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: rgba(0, 0, 0, 0.45);
}

.report-modal {
  width: 420px;
  max-width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  padding: 20px 24px;
  background-color: var(--color-surface);
  // 圆角收敛到 8px：--radius-md(12px) 在小弹窗上观感偏圆（2026-11-25 用户反馈）
  border-radius: 8px;
  box-shadow: var(--shadow-2);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text-1);
  }

  .modal-close {
    padding: 0 4px;
    border: 0;
    background-color: transparent;
    font-size: 20px;
    line-height: 1;
    color: var(--color-text-3);
    cursor: pointer;

    &:hover {
      color: var(--color-text-1);
    }
  }
}

.report-target {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background-color: var(--color-bg);
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-2);
  overflow-wrap: anywhere;
}

.report-row {
  margin-bottom: 14px;

  .row-label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--color-text-2);
  }
}

// 理由选项：胶囊组流式排布，选中态主题色描边
.reason-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .reason-pill {
    padding: 5px 14px;
    border: 1px solid var(--color-border-light);
    // 与全站按钮/标签同款 4px 小圆角（原 999px 大圆角偏夸张，用户反馈收敛）
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    font-size: 13px;
    color: var(--color-text-2);
    cursor: pointer;
    transition:
      color 0.2s ease,
      border-color 0.2s ease,
      background-color 0.2s ease;

    &:hover {
      color: var(--color-text-1);
      border-color: var(--color-border);
    }

    &.active {
      border-color: var(--color-primary);
      background-color: var(--color-primary-light);
      color: var(--color-primary);
      font-weight: 500;
    }
  }

  .reason-loading {
    font-size: 13px;
    color: var(--color-text-3);
  }
}

.row-field {
  position: relative;
  display: block;

  .form-textarea {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    font-size: 13px;
    line-height: 20px;
    color: var(--color-text-1);
    resize: vertical;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--color-primary);
    }
  }

  .char-count {
    position: absolute;
    right: 10px;
    bottom: 8px;
    font-size: 11px;
    color: var(--color-text-3);

    &.over {
      color: #d1242f;
    }
  }
}

.form-tip {
  margin: 0 0 10px;
  font-size: 13px;

  &.tip-error {
    color: #d1242f;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
</style>
