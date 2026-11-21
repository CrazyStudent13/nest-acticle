<!-- 编辑器发布/保存弹窗：封面 16:9 裁剪上传（悬浮移除）/选专栏（无已发布专栏整行隐藏）/简介/提交。
     状态与动作来自页面侧 usePublish() 的同一 reactive store 实例（publish prop），显隐 v-model；
     编辑模式（editId）下标题与按钮文案切换为"编辑文章/保存修改" -->
<template>
  <Teleport to="body">
    <div v-if="open" class="publish-overlay" @click.self="open = false">
      <div class="publish-modal">
        <div class="modal-head">
          <h2>{{ editId ? '编辑文章' : '发布文章' }}</h2>
          <button class="modal-close" type="button" @click="open = false">×</button>
        </div>

        <label class="modal-row">
          <span class="row-label">封面</span>
          <span class="row-field">
            <button class="cover-box" type="button" :disabled="publish.coverUploading" @click="coverInput?.click()">
              <img v-if="publish.publishForm.cover" class="cover-img" :src="publish.coverPreview" alt="封面" />
              <span v-else class="cover-placeholder">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {{ publish.coverUploading ? '上传中…' : '上传封面' }}
              </span>
              <!-- 悬浮移除：已选封面时 hover 显现，点击不触发更换 -->
              <span
                v-if="publish.publishForm.cover && !publish.coverUploading"
                class="cover-remove"
                role="button"
                tabindex="-1"
                @click.stop="publish.removeCover()"
              >
                移除
              </span>
            </button>
            <input ref="coverInput" class="img-input" type="file" accept="image/*" @change="publish.handleCoverChange" />
          </span>
        </label>
        <!-- 上传前提示限制，超限时顶部 toast 提醒 -->
        <p class="upload-hint">封面支持 JPG、PNG，不超过 5M</p>

        <!-- 没有任何已发布专栏时整行隐藏，发布不再强制选专栏 -->
        <label v-if="publish.subjectsLoading || publish.subjects.length" class="modal-row">
          <span class="row-label">专栏</span>
          <span class="row-field">
            <select v-model="publish.publishForm.subjectId" class="form-input">
              <option value="" disabled>{{ publish.subjectsLoading ? '专栏加载中…' : '请选择专栏' }}</option>
              <option v-for="s in publish.subjects" :key="s.id" :value="String(s.id)">{{ s.title }}</option>
            </select>
          </span>
        </label>

        <label class="modal-row">
          <span class="row-label">简介</span>
          <span class="row-field">
            <textarea
              v-model="publish.publishForm.desc"
              class="form-input form-textarea"
              rows="4"
              maxlength="255"
              placeholder="展示在文章列表的摘要，留空则不填"
            />
          </span>
        </label>

        <p v-if="publish.publishTip" class="form-tip tip-error">{{ publish.publishTip }}</p>

        <div class="modal-actions">
          <button class="btn ghost" type="button" @click="open = false">取消</button>
          <button class="btn primary" type="button" :disabled="publish.publishing" @click="publish.confirmPublish">
            {{ publish.publishing ? (editId ? '保存中…' : '发布中…') : editId ? '保存修改' : '确认发布' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { PublishStore } from '~/composables/usePublish'

defineProps<{
  // 页面侧 usePublish() 返回的 reactive store（状态+动作同源，页面与弹窗共用同一实例，随页面挂载销毁）
  publish: PublishStore
  // 编辑模式（?id=）标识：切换弹窗标题/确认按钮文案
  editId: string
}>()

// 显隐双向绑定：页面 openPublish 校验通过后置 true，遮罩点击/×/取消/发布成功后关闭
const open = defineModel<boolean>()

// 封面选择框元素（上传动作 publish.handleCoverChange 从事件对象取文件并重置 value）
const coverInput = ref<HTMLInputElement | null>(null)
</script>

<style lang="less" scoped>
// 隐藏原生文件选择框（页面工具栏图片按钮的 .img-input 为各自 scoped 内的独立声明）
.img-input {
  display: none;
}

.publish-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.45);

  .publish-modal {
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

      .row-label {
        flex-shrink: 0;
        width: 48px;
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
    }

    // 封面上传限制的前置提示：与输入区左缘对齐
    .upload-hint {
      margin: -6px 0 14px 60px;
      font-size: 12px;
      color: var(--color-text-3);
    }

    .cover-box {
      width: 240px;
      height: 135px;
      padding: 0;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-sm);
      background-color: var(--color-bg);
      cursor: pointer;
      overflow: hidden;
      transition: border-color 0.2s ease;
      position: relative;

      &:hover:not(:disabled) {
        border-color: var(--color-primary);
      }

      &:disabled {
        cursor: wait;
      }

      .cover-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .cover-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 12px;
        color: var(--color-text-3);
      }

      // 已选封面时的悬浮操作层：点击任意处可更换
      .cover-remove {
        position: absolute;
        right: 6px;
        bottom: 6px;
        padding: 3px 10px;
        border: 0;
        border-radius: var(--radius-sm);
        background-color: rgba(0, 0, 0, 0.55);
        color: #fff;
        font-size: 12px;
        cursor: pointer;
        opacity: 0;
        transition:
          opacity 0.2s ease,
          background-color 0.2s ease;

        &:hover {
          background-color: rgba(209, 36, 47, 0.8);
        }
      }
    }

    &:hover .cover-remove {
      opacity: 1;
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
      margin: 0 0 4px 60px;
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
}
</style>
