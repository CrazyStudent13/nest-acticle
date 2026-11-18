#!/usr/bin/env bash
# 服务器更新入口：只拉镜像不构建（2G 内存机器禁止在机构建），在仓库根目录执行
set -euo pipefail

docker compose pull server web admin
docker compose up -d --no-build
docker image prune -f