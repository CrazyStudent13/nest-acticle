# monorepo 版：构建上下文为仓库根目录（见根 docker-compose.yml 的 build.context）
FROM node:22-bookworm-slim

WORKDIR /app

# 安装 pnpm（与根 package.json 的 packageManager 一致）
RUN npm install -g pnpm@10.33.0 --registry=https://mirrors.cloud.tencent.com/npm/

# 先拷依赖清单（利用 Docker 层缓存），再按过滤安装
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/server/package.json ./apps/server/

# 只装 server 的依赖（--frozen-lockfile 使用根级锁文件）
RUN pnpm install --frozen-lockfile --filter server --registry=https://mirrors.cloud.tencent.com/npm/

# 拷源码并构建（nest-cli.json 的 assets 会把 src/config/env/*.yml 复制进 dist）
COPY apps/server ./apps/server
WORKDIR /app/apps/server
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 8080

# 工作目录即 apps/server：dist/env 的 yml、./upload 上传目录、./logs 均相对此目录
CMD ["node", "dist/main"]
