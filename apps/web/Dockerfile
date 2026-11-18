# monorepo 版：构建上下文为仓库根目录（见根 docker-compose.yml 的 build.context）

# NPM_REGISTRY 可在构建时覆盖（GitHub Actions 海外构建机用官方源更快，本地默认腾讯源不变）
ARG NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/

# 第一阶段：构建（Nuxt SSR 产物 .output）
FROM node:22-alpine AS builder
ARG NPM_REGISTRY

WORKDIR /app

# 安装 pnpm（与根 package.json 的 packageManager 一致）
RUN npm install -g pnpm@10.33.0 --registry=$NPM_REGISTRY

# 先拷依赖清单（利用 Docker 层缓存），再按过滤安装
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter web --registry=$NPM_REGISTRY

# 拷源码并构建
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm build

# 第二阶段：仅带产物运行（Nitro node server）
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/web/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
