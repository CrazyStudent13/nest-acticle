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
COPY apps/client/package.json ./apps/client/
COPY packages/shared/package.json ./packages/shared/
COPY packages/utils/package.json ./packages/utils/

# 过滤安装需同时选中 workspace 包：--filter 只装被选项目的 devDeps，workspace 依赖包也不例外
RUN pnpm install --frozen-lockfile --filter client --filter @nest-acticle/shared --filter @nest-acticle/utils --registry=$NPM_REGISTRY

# 拷源码并构建（Nuxt 产物 .output）
# pnpm -r 按拓扑序构建：先 workspace 依赖（@nest-acticle/shared、@nest-acticle/utils），再 client 本体
COPY apps/client ./apps/client
COPY packages/shared ./packages/shared
COPY packages/utils ./packages/utils
WORKDIR /app
RUN pnpm -r build

# 第二阶段：仅带产物运行（Nitro node server）
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/client/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
