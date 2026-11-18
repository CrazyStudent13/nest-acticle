# monorepo 版：构建上下文为仓库根目录（见根 docker-compose.yml 的 build.context）

# NPM_REGISTRY 可在构建时覆盖（GitHub Actions 海外构建机用官方源更快，本地默认腾讯源不变）
ARG NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/

# 第一阶段：构建
FROM node:22-alpine AS builder
ARG NPM_REGISTRY

WORKDIR /app

# 安装 pnpm（与根 package.json 的 packageManager 一致）
RUN npm install -g pnpm@10.33.0 --registry=$NPM_REGISTRY

# 先拷依赖清单（利用 Docker 层缓存），再按过滤安装
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/
COPY packages/utils/package.json ./packages/utils/

# 过滤安装需同时选中 workspace 包：--filter 只装被选项目的 devDeps，workspace 依赖包也不例外
RUN pnpm install --frozen-lockfile --filter admin --filter @nest-acticle/shared --filter @nest-acticle/utils --registry=$NPM_REGISTRY

# 拷源码并构建（读取 apps/admin/.env.production：VITE_APP_BASE_API=/api）
# pnpm -r 按拓扑序构建：先 workspace 依赖（@nest-acticle/shared、@nest-acticle/utils），再 admin 本体
COPY apps/admin ./apps/admin
COPY packages/shared ./packages/shared
COPY packages/utils ./packages/utils
WORKDIR /app
RUN pnpm -r build

# 第二阶段：使用 Nginx 提供静态文件服务
FROM nginx:alpine

# 静态资源 + 反代配置（/api、/profile、/uploads → server 容器；配置内不含环境变量，直接落位）
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
