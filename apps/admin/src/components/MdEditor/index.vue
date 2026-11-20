<template>
  <MdEditor v-model="editorValue" :theme="theme" :preview="preview" :previewTheme="previewTheme" :codeTheme="codeTheme" :showCodeRowNumber="true" :toolbars="toolbars" :placeholder="placeholder" :height="height" :style="{ minHeight }" :disabled="uploading" @onChange="handleChange" @onUploadImg="handleUploadImg" />
</template>

<script setup lang="ts">
/**
 * Markdown 编辑器组件
 * 基于 md-editor-v3 封装
 * 官方文档: https://imzbf.github.io/md-editor-v3/
 */
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import request from '@/composables/useRequest';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  height: {
    type: String,
    default: '400px'
  },
  minHeight: {
    type: String,
    default: '75vh'
  },
  preview: {
    type: Boolean,
    default: true
  },
  theme: {
    type: String,
    default: 'light'
  },
  placeholder: {
    type: String,
    default: '请输入内容（支持 Markdown 语法）'
  }
});

const emit = defineEmits(['update:modelValue', 'change', 'upload-image']);

const editorValue = ref(props.modelValue);

const previewTheme = 'vuepress';
const codeTheme = 'atom';

const toolbars = [
  'bold',
  'underline',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'sub',
  'sup',
  'quote',
  'unorderedList',
  'orderedList',
  'task',
  '-',
  'codeRow',
  'code',
  'link',
  'image',
  'table',
  'mermaid',
  'katex',
  '-',
  'revoke',
  'next',
  'save',
  '=',
  'pageFullscreen',
  'fullscreen',
  'preview',
  'htmlPreview',
  'catalog'
];

// 监听 props.modelValue 变化，同步到本地变量
watch(
  () => props.modelValue,
  (newVal) => {
    editorValue.value = newVal;
  }
);

// 内容变化事件
const handleChange = (text, html) => {
  emit('update:modelValue', text);
  emit('change', { text, html });
};

// 图片上传状态：上传期间禁用编辑器，防止继续编辑造成插入位置错乱
const uploading = ref(false);

// 大小上限与服务端对齐（apps/server app.file.maxSize / UPLOAD_MAX_SIZE_MB，均为 10MB）
const MAX_IMG_SIZE_MB = 10;

// 图片上传事件：走统一上传端点回填 URL，不再 Base64 内嵌正文
const handleUploadImg = async (files: File[], callback: (urls: string[]) => void) => {
  const file = files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    ElMessage.error('仅支持上传图片文件');
    return;
  }
  if (file.size > MAX_IMG_SIZE_MB * 1024 * 1024) {
    ElMessage.error(`图片大小不能超过 ${MAX_IMG_SIZE_MB}MB`);
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file);
    // 默认 axios 超时 10s 对大图上传偏紧，单独放宽
    const res = await request({ url: '/common/upload', method: 'post', data: formData, timeout: 60000 });
    const url = res?.data?.url;
    if (!url) {
      ElMessage.error('上传失败：未获取到图片地址');
      return;
    }
    callback([url]);
  } catch (error) {
    // 失败信封已由 useRequest 拦截器统一 message 提示，这里不往正文插入内容
    console.error('图片上传失败:', error);
  } finally {
    uploading.value = false;
  }
};
</script>
