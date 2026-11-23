<!-- 收藏集新建/编辑弹窗：名称+简介+私密开关；编辑时传入行数据预填表单（补丁式提交，未改字段不传） -->
<template>
  <Teleport to="body">
    <div class="collect-overlay" @click.self="emit('close')">
      <div class="collect-modal">
        <div class="modal-head">
          <h2>{{ isEdit ? '编辑收藏集' : '新建收藏集' }}</h2>
          <button class="modal-close" type="button" @click="emit('close')">×</button>
        </div>

        <label class="modal-row">
          <span class="row-label">名称</span>
          <span class="row-field">
            <span class="field-wrap">
              <input v-model="form.name" class="form-input" type="text" maxlength="32" placeholder="请输入收藏集名称（32 字以内）" />
              <span class="char-count" :class="{ over: form.name.length >= 32 }">{{ form.name.length }}/32</span>
            </span>
          </span>
        </label>

        <label class="modal-row">
          <span class="row-label">简介</span>
          <span class="row-field">
            <span class="field-wrap">
              <textarea
                v-model="form.desc"
                class="form-input form-textarea"
                rows="3"
                maxlength="250"
                placeholder="介绍一下这个收藏集的内容，留空则不填"
              />
              <span class="char-count" :class="{ over: form.desc.length >= 250 }">{{ form.desc.length }}/250</span>
            </span>
          </span>
        </label>

        <label class="modal-row modal-row--switch">
          <span class="row-label">仅自己可见</span>
          <span class="row-field">
            <button
              class="visibility-switch"
              :class="{ on: form.visibility === '1' }"
              type="button"
              role="switch"
              :aria-checked="form.visibility === '1'"
              @click="toggleVisibility"
            >
              <i class="switch-dot" />
            </button>
            <span class="switch-hint">{{ form.visibility === '1' ? '私密：只有自己能看到' : '公开：其他用户可浏览与订阅' }}</span>
          </span>
        </label>

        <p v-if="tip" class="form-tip tip-error">{{ tip }}</p>

        <div class="modal-actions">
          <button class="btn ghost" type="button" @click="emit('close')">取消</button>
          <button class="btn primary" type="button" :disabled="submitting" @click="confirmSubmit">
            {{ submitting ? '保存中…' : isEdit ? '保存修改' : '确认创建' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Collection } from '@nest-acticle/shared'

const props = defineProps<{
  // 编辑时传入的行数据（预填表单），新建时为 null
  collection?: Collection | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const { createCollection, updateCollection } = useCollect()

const isEdit = computed(() => !!props.collection?.id)

const form = reactive({ name: '', desc: '', visibility: '0' })
const tip = ref('')
const submitting = ref(false)

// 编辑模式用行数据预填
onMounted(() => {
  if (props.collection) {
    form.name = props.collection.name || ''
    form.desc = props.collection.desc || ''
    form.visibility = props.collection.visibility || '0'
  }
})

const toggleVisibility = () => {
  form.visibility = form.visibility === '1' ? '0' : '1'
}

const confirmSubmit = async () => {
  const name = form.name.trim()
  if (!name) {
    tip.value = '请输入收藏集名称'
    return
  }
  // maxlength 只对真实键入生效，程序化赋值可绕过，提交前再校验一次
  if (name.length > 32) {
    tip.value = '收藏集名称不能超过 32 字'
    return
  }
  // 后端 post_collection.desc 列为 varchar(255)，简介限制在 250 字留出余量
  if (form.desc.length > 250) {
    tip.value = '简介不能超过 250 字'
    return
  }
  submitting.value = true
  tip.value = ''
  try {
    if (props.collection?.id) {
      await updateCollection({
        id: props.collection.id,
        name,
        desc: form.desc.trim(),
        visibility: form.visibility
      })
    } else {
      await createCollection({
        name,
        desc: form.desc.trim() || undefined,
        visibility: form.visibility
      })
    }
    emit('saved')
  } catch (error: any) {
    tip.value = error?.message || '保存失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="less" scoped>
// 弹窗骨架与专栏编辑弹窗同款
.collect-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.45);
}

.collect-modal {
  width: 480px;
  max-width: calc(100vw - 32px);
  padding: 20px 24px;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);

  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;

    h2 {
      font-size: 17px;
      font-weight: 600;
      color: var(--color-text-1);
    }

    .modal-close {
      padding: 0 4px;
      border: 0;
      background-color: transparent;
      font-size: 20px;
      line-height: 24px;
      color: var(--color-text-3);
      cursor: pointer;

      &:hover {
        color: var(--color-text-1);
      }
    }
  }

  .modal-row {
    display: flex;
    gap: 12px;
    margin-bottom: 14px;

    &.modal-row--switch {
      align-items: center;

      .row-label {
        padding-top: 0;
      }
    }

    .row-label {
      flex-shrink: 0;
      width: 72px;
      padding-top: 8px;
      font-size: 13px;
      color: var(--color-text-2);
      text-align: right;
    }

    .row-field {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    // 字段容器：承载右下/右侧的字数计数
    .field-wrap {
      position: relative;
      flex: 1;
      min-width: 0;
      display: flex;

      // 给字数计数留出空间
      .form-input {
        flex: 1;
        width: 100%;
        padding-right: 52px;
      }

      .form-textarea {
        padding-bottom: 26px;
      }
    }

    .char-count {
      position: absolute;
      right: 10px;
      bottom: 6px;
      font-size: 12px;
      line-height: 16px;
      color: var(--color-text-3);
      pointer-events: none;

      // 名称单行输入框：计数垂直居中
      .modal-row:first-of-type & {
        top: 50%;
        bottom: auto;
        transform: translateY(-50%);
      }

      // 接近/达到上限时变红提醒
      &.over {
        color: #d1242f;
      }
    }
  }

  // 私密开关：胶囊滑块
  .visibility-switch {
    flex-shrink: 0;
    width: 36px;
    height: 20px;
    padding: 0;
    display: flex;
    align-items: center;
    border: 0;
    border-radius: var(--radius-full);
    background-color: var(--color-border);
    cursor: pointer;
    transition: background-color 0.2s ease;

    &.on {
      background-color: var(--color-primary);
    }

    .switch-dot {
      width: 16px;
      height: 16px;
      margin-left: 2px;
      border-radius: var(--radius-full);
      background-color: #fff;
      transition: transform 0.2s ease;
    }

    &.on .switch-dot {
      transform: translateX(16px);
    }
  }

  .switch-hint {
    font-size: 12px;
    color: var(--color-text-3);
  }

  .form-input {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg);
    font-size: 13px;
    color: var(--color-text-1);
    outline: none;
    transition: border-color 0.2s ease;

    &:focus {
      border-color: var(--color-primary);
    }
  }

  .form-textarea {
    resize: vertical;
    line-height: 1.7;
  }

  .form-tip {
    margin: 0 0 4px 84px;
    font-size: 12px;

    &.tip-error {
      color: #d1242f;
    }
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 18px;

    .btn {
      padding: 7px 18px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;

      &.ghost {
        border: 1px solid var(--color-border);
        background-color: transparent;
        color: var(--color-text-2);

        &:hover {
          border-color: var(--color-text-3);
          color: var(--color-text-1);
        }
      }

      &.primary {
        border: 0;
        background-color: var(--color-primary);
        color: #fff;

        &:hover:not(:disabled) {
          background-color: var(--color-primary-hover);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }
  }
}
</style>
