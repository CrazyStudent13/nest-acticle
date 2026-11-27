<!-- 文章收藏弹窗：勾选目标收藏集（status 接口给出各集当前 collected 勾选态）→
     确认时 diff 出 collect/uncollect 调用；行内"新建收藏集"折叠表单（创建后自动勾选）；
     私密集带锁图标；父组件条件渲染（同 ColumnEditModal 模式） -->
<template>
  <Teleport to="body">
    <div class="collect-overlay" @click.self="emit('close')">
      <div class="collect-modal">
        <div class="modal-head">
          <h2>收藏到收藏集</h2>
          <button class="modal-close" type="button" @click="emit('close')">×</button>
        </div>

        <!-- 收藏集勾选列表 -->
        <div class="collection-list">
          <template v-if="items.length">
            <button
              v-for="item in items"
              :key="item.id"
              class="collection-item"
              :class="{ checked: checkedIds.has(item.id) }"
              type="button"
              :disabled="busy"
              @click="toggleItem(item.id)"
            >
              <span class="check-box" aria-hidden="true">
                <svg v-if="checkedIds.has(item.id)" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span class="item-name">
                {{ item.name }}
                <span v-if="item.isDefault" class="item-default-badge">默认</span>
              </span>
              <svg v-if="item.visibility === '1'" class="item-lock" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </button>
          </template>
          <p v-else-if="loading" class="list-empty">加载中…</p>
          <p v-else class="list-empty">还没有收藏集，先新建一个吧</p>
        </div>

        <!-- 新建收藏集：折叠表单，创建成功后自动勾选新集 -->
        <div v-if="creating" class="create-row">
          <input v-model="newName" class="create-input" type="text" maxlength="32" placeholder="收藏集名称（32 字以内）" @keyup.enter="confirmCreate" />
          <button class="create-visibility" type="button" :title="newVisibility === '1' ? '私密收藏集' : '公开收藏集'" @click="newVisibility = newVisibility === '1' ? '0' : '1'">
            <svg v-if="newVisibility === '1'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <AppIcon v-else name="eye" :size="15" />
          </button>
          <button class="create-confirm" type="button" :disabled="creatingBusy || !newName.trim()" @click="confirmCreate">
            {{ creatingBusy ? '创建中…' : '创建' }}
          </button>
        </div>

        <p v-if="tip" class="form-tip tip-error">{{ tip }}</p>

        <div class="modal-actions">
          <button v-if="!creating" class="btn ghost" type="button" @click="openCreate">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建收藏集
          </button>
          <button v-else class="btn ghost" type="button" @click="cancelCreate">取消新建</button>
          <button class="btn primary" type="button" :disabled="busy" @click="confirmSubmit">
            {{ busy ? '保存中…' : '完成' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { CollectionStatusItem } from '@nest-acticle/shared'

const props = defineProps<{
  /** 要收藏的文章 id */
  articleId: number | string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /** 确认后回调：collected 供 ActionBar 高亮，delta 为本次收藏/移出的净变化量（供文章收藏数校准） */
  (e: 'done', collected: boolean, delta: number): void
}>()

const { fetchCollectStatus, createCollection, collectArticle, uncollectArticle } = useCollect()

const items = ref<CollectionStatusItem[]>([])
const loading = ref(true)
const busy = ref(false)
const tip = ref('')

// 勾选态：以接口返回的 collected 为初值，diff 出需要 collect/uncollect 的集合
const checkedIds = ref<Set<number>>(new Set())

// 行内新建表单态
const creating = ref(false)
const creatingBusy = ref(false)
const newName = ref('')
const newVisibility = ref('0')

onMounted(async () => {
  try {
    const list = await fetchCollectStatus(props.articleId)
    items.value = list
    checkedIds.value = new Set(list.filter((item) => item.collected).map((item) => item.id))
  } catch (error: any) {
    tip.value = error?.message || '收藏状态加载失败'
  } finally {
    loading.value = false
  }
})

const toggleItem = (id: number) => {
  const next = new Set(checkedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  checkedIds.value = next
}

const openCreate = () => {
  creating.value = true
  newName.value = ''
  newVisibility.value = '0'
  tip.value = ''
}

const cancelCreate = () => {
  creating.value = false
  tip.value = ''
}

// 行内创建成功后把新集插入列表首位并自动勾选
const confirmCreate = async () => {
  const name = newName.value.trim()
  if (!name) {
    tip.value = '请输入收藏集名称'
    return
  }
  creatingBusy.value = true
  tip.value = ''
  try {
    const created = await createCollection({ name, visibility: newVisibility.value })
    if (created?.id) {
      items.value = [{ id: created.id, name: created.name || name, visibility: created.visibility || newVisibility.value, collected: false }, ...items.value]
      toggleItem(created.id)
    }
    creating.value = false
    showToast('收藏集创建成功', 'success')
  } catch (error: any) {
    tip.value = error?.message || '创建失败，请稍后重试'
  } finally {
    creatingBusy.value = false
  }
}

// 确认：diff 初值勾选态与当前勾选态，逐个调用 collect/uncollect（后端幂等，失败中断并提示）
const confirmSubmit = async () => {
  const before = new Set(items.value.filter((item) => item.collected).map((item) => item.id))
  const after = checkedIds.value

  const toCollect = [...after].filter((id) => !before.has(id))
  const toUncollect = [...before].filter((id) => !after.has(id))
  if (!toCollect.length && !toUncollect.length) {
    emit('close')
    return
  }

  busy.value = true
  tip.value = ''
  try {
    for (const id of toCollect) {
      await collectArticle(id, props.articleId)
      const item = items.value.find((row) => row.id === id)
      if (item) {
        item.collected = true
      }
    }
    for (const id of toUncollect) {
      await uncollectArticle(id, props.articleId)
      const item = items.value.find((row) => row.id === id)
      if (item) {
        item.collected = false
      }
    }
    const collected = items.value.some((item) => item.collected)
    if (toCollect.length) {
      showToast('已收藏', 'success')
    } else {
      showToast('已取消收藏', 'success')
    }
    emit('done', collected, toCollect.length - toUncollect.length)
  } catch (error: any) {
    tip.value = error?.message || '收藏操作失败，请稍后重试'
  } finally {
    busy.value = false
  }
}
</script>

<style lang="less" scoped>
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
  width: 420px;
  max-width: calc(100vw - 32px);
  padding: 20px 24px;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);

  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;

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

  .collection-list {
    max-height: 280px;
    min-height: 120px;
    overflow-y: auto;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg);

    .collection-item {
      width: 100%;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 0;
      border-bottom: 1px solid var(--color-border-light);
      background-color: transparent;
      font-size: 13px;
      color: var(--color-text-1);
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s ease;

      &:last-child {
        border-bottom: 0;
      }

      &:hover:not(:disabled) {
        background-color: var(--color-primary-light);
      }

      &:disabled {
        cursor: wait;
        opacity: 0.7;
      }

      .check-box {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background-color: var(--color-surface);
        color: #fff;
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease;
      }

      &.checked .check-box {
        border-color: var(--color-primary);
        background-color: var(--color-primary);
      }

      .item-name {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        .item-default-badge {
          flex-shrink: 0;
          padding: 0 6px;
          border: 1px solid var(--color-primary);
          border-radius: var(--radius-full);
          font-size: 10px;
          line-height: 15px;
          color: var(--color-primary);
        }
      }

      .item-lock {
        flex-shrink: 0;
        color: var(--color-text-3);
      }
    }

    .list-empty {
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      color: var(--color-text-3);
    }
  }

  // 行内新建表单：名称输入 + 可见性切换 + 创建按钮
  .create-row {
    display: flex;
    gap: 8px;
    margin-top: 12px;

    .create-input {
      flex: 1;
      min-width: 0;
      padding: 7px 12px;
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

    .create-visibility {
      flex-shrink: 0;
      width: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-sm);
      background-color: var(--color-bg);
      color: var(--color-text-3);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        color 0.2s ease;

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
    }

    .create-confirm {
      flex-shrink: 0;
      padding: 0 16px;
      border: 0;
      border-radius: var(--radius-sm);
      background-color: var(--color-primary);
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      transition: background-color 0.2s ease;

      &:hover:not(:disabled) {
        background-color: var(--color-primary-hover);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }

  .form-tip {
    margin: 8px 0 0;
    font-size: 12px;

    &.tip-error {
      color: #d1242f;
    }
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    margin-top: 18px;

    .btn {
      padding: 7px 14px;
      display: flex;
      align-items: center;
      gap: 5px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;

      &.ghost {
        border: 1px solid var(--color-border);
        background-color: transparent;
        color: var(--color-text-2);

        &:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
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
