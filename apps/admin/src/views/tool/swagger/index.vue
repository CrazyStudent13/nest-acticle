<template>
  <div class="swagger-container">
    <el-card class="swagger-card">
      <div class="swagger-entry">
        <el-icon :size="48" class="entry-icon"><Promotion /></el-icon>
        <h3 class="entry-title">后端接口文档</h3>
        <p class="entry-desc">NestJS 后端 Swagger UI，支持在线查看与调试全部接口</p>
        <el-button :icon="TopRight" type="primary" @click="openSwagger">打开 Swagger UI</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup name="Swagger">
import { Promotion, TopRight } from '@element-plus/icons-vue';

// 开发环境经 vite 代理（/dev-api → /api），生产环境走同源 /api 前缀
const swaggerUrl = `${import.meta.env.VITE_APP_BASE_API}/swagger-ui`;

const openSwagger = () => {
  window.open(swaggerUrl, '_blank');
};
</script>

<style lang="scss" scoped>
.swagger-container {
  padding: 20px;

  .swagger-card {
    border-radius: 8px;
  }

  .swagger-entry {
    padding: 60px 20px;
    text-align: center;

    .entry-icon {
      color: #409eff;
    }

    .entry-title {
      margin: 16px 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: #303133;
    }

    .entry-desc {
      margin: 0 0 24px;
      font-size: 14px;
      color: #909399;
    }
  }
}
</style>
