# monorepo 版：构建上下文为仓库根目录（见根 docker-compose.yml 的 build.context）

# NPM_REGISTRY 可在构建时覆盖（GitHub Actions 海外构建机用官方源更快，本地默认腾讯源不变）
ARG NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/

# 第一阶段：构建 VitePress 静态站点（docs 仅依赖 vitepress，无 workspace 包）
FROM node:22-alpine AS builder
ARG NPM_REGISTRY

WORKDIR /app

# 安装 pnpm（与根 package.json 的 packageManager 一致）
RUN npm install -g pnpm@10.33.0 --registry=$NPM_REGISTRY

# 先拷依赖清单（利用 Docker 层缓存），再按过滤安装
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/docs/package.json ./apps/docs/

RUN pnpm install --frozen-lockfile --filter docs --registry=$NPM_REGISTRY

# 拷源码并构建（VitePress base=/manual/，产物在 .vitepress/dist）
COPY apps/docs ./apps/docs
WORKDIR /app/apps/docs
RUN pnpm run build

# 第二阶段：Nginx 静态托管（文件放 html/manual/ 下，与 base 前缀逐字对应；
# blog-nginx 以变量 proxy_pass 透传原始 URI，容器内不再做前缀改写）
FROM nginx:alpine

COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/docs/.vitepress/dist /usr/share/nginx/html/manual

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
