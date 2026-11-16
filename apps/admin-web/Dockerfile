# monorepo 版：构建上下文为仓库根目录（见根 docker-compose.yml 的 build.context）

# 第一阶段：构建
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm（与根 package.json 的 packageManager 一致）
RUN npm install -g pnpm@10.33.0 --registry=https://mirrors.cloud.tencent.com/npm/

# 先拷依赖清单（利用 Docker 层缓存），再按过滤安装
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/admin-web/package.json ./apps/admin-web/

RUN pnpm install --frozen-lockfile --filter admin-web --registry=https://mirrors.cloud.tencent.com/npm/

# 拷源码并构建（读取 apps/admin-web/.env.production：VITE_APP_BASE_API=/api）
COPY apps/admin-web ./apps/admin-web
WORKDIR /app/apps/admin-web
RUN pnpm build

# 第二阶段：使用 Nginx 提供静态文件服务
FROM nginx:alpine

# 静态资源 + 反代配置（/api、/profile、/uploads → server 容器；配置内不含环境变量，直接落位）
COPY apps/admin-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin-web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
