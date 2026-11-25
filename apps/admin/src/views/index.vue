<template>
  <div class="app-container home">
    <el-card class="welcome-card">
      <div class="welcome-body">
        <h2 class="welcome-title">{{ greeting }}，欢迎回到 nest-acticle 管理后台</h2>
        <p class="welcome-desc">博客平台内容管理系统：文章 / 专栏 / 评论 / 点赞 / 用户与系统设置均可在左侧菜单进入。</p>
        <div class="welcome-actions">
          <el-button :icon="Promotion" type="primary" @click="openSwagger">接口文档</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup name="Index">
import { Promotion } from '@element-plus/icons-vue';

const hour = new Date().getHours();
const greeting = hour < 6 ? '凌晨好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

// 接口文档走 nginx 静态托管（同源根路径，无 /api 前缀）——与「服务工具→接口文档」三入口页同款链接；
// 服务端 setupApiDocs 挂载路径因 app.prefix 无前导斜杠对请求不可达，加前缀反而 404
const swaggerUrl = '/swagger-ui/';

const openSwagger = () => {
  window.open(swaggerUrl, '_blank');
};
</script>

<style scoped lang="scss">
.home {
  .welcome-card {
    border-radius: 8px;
  }

  .welcome-body {
    padding: 40px 20px;
    text-align: center;
  }

  .welcome-title {
    margin: 0 0 12px;
    font-size: 24px;
    font-weight: 600;
    color: #303133;
  }

  .welcome-desc {
    margin: 0 0 24px;
    font-size: 14px;
    color: #909399;
  }

  .welcome-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
  }
}
</style>
