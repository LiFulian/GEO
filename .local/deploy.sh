#!/bin/bash
# ============================================================================
# deploy.sh — GEO Studio 本地 → 服务器部署脚本
# ----------------------------------------------------------------------------
# 作用：本地构建前端 → 同步到服务器 → 重启 PocketBase → 验证
#
# 目标服务器: 81.70.168.55 (SSH alias: tengxun2c2g)
# 项目路径:   /home/ubuntu/geo.fulianli.top/
# 服务:       pocketbase-geo-fulianli-top.service (端口 8085)
# 前端:       nginx 直接托管 frontend/dist
#
# 用法：
#   bash deploy.sh           # 完整部署
#   bash deploy.sh --frontend  # 仅更新前端
#   bash deploy.sh --backend   # 仅更新后端（migrations）
#   bash deploy.sh --check     # 仅验证，不部署
#
# 前置：
#   - SSH alias tengxun2c2g 已配置
#   - 本地已安装 node + npm + rsync
# ============================================================================

set -e

# ---------- 配置 ----------
SSH_ALIAS="tengxun2c2g"
REMOTE_BASE="/home/ubuntu/geo.fulianli.top"
REMOTE_FRONTEND="$REMOTE_BASE/frontend/dist"
REMOTE_BACKEND="$REMOTE_BASE/backend"
REMOTE_MIGRATIONS="$REMOTE_BACKEND/pb_migrations"
SERVICE="pocketbase-geo-fulianli-top"
DOMAIN="https://geo.fulianli.top"
PB_PORT="8085"

# ---------- 颜色 ----------
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'
log()  { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} $1"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)]${NC} $1"; }

# ---------- 参数解析 ----------
MODE="all"
case "$1" in
  --frontend)  MODE="frontend" ;;
  --backend)   MODE="backend" ;;
  --check)     MODE="check" ;;
  --help|-h)   sed -n '2,22p' "$0"; exit 0 ;;
  "")          MODE="all" ;;
  *)           err "未知参数: $1（可用: --frontend --backend --check）"; exit 2 ;;
esac

# ---------- 前置检查 ----------
check_prereq() {
  log "前置检查..."
  command -v node >/dev/null || { err "node 未安装"; exit 1; }
  command -v rsync >/dev/null || { err "rsync 未安装"; exit 1; }
  ssh -o BatchMode=yes -o ConnectTimeout=5 "$SSH_ALIAS" "echo ok" >/dev/null 2>&1 \
    || { err "SSH $SSH_ALIAS 连接失败"; exit 1; }
  log "前置检查通过"
}

# ---------- 构建前端 ----------
build_frontend() {
  log "构建前端..."
  cd frontend
  npm run build
  cd ..
  log "前端构建完成: $(ls frontend/dist | tr '\n' ' ')"
}

# ---------- 同步前端 ----------
sync_frontend() {
  log "同步前端 dist → $SSH_ALIAS:$REMOTE_FRONTEND"
  rsync -azP --delete \
    --exclude='.DS_Store' \
    frontend/dist/ \
    "$SSH_ALIAS:$REMOTE_FRONTEND/"
  log "前端同步完成"
}

# ---------- 同步后端 migrations ----------
sync_backend() {
  log "同步 pb_migrations → $SSH_ALIAS:$REMOTE_MIGRATIONS"
  rsync -azP --delete \
    --exclude='.DS_Store' \
    pocketbase/pb_migrations/ \
    "$SSH_ALIAS:$REMOTE_MIGRATIONS/"
  log "后端 migrations 同步完成"
}

# ---------- 备份并重启 PB ----------
restart_pb() {
  log "备份 pb_data..."
  ssh "$SSH_ALIAS" "cp -r $REMOTE_BACKEND/pb_data $REMOTE_BACKEND/pb_data.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null; ls -dt $REMOTE_BACKEND/pb_data.bak.* 2>/dev/null | head -3 | xargs rm -rf 2>/dev/null; echo backup done"

  log "重启 $SERVICE..."
  ssh "$SSH_ALIAS" "sudo systemctl restart $SERVICE"
  sleep 2
  log "PocketBase 重启完成"
}

# ---------- 验证 ----------
verify() {
  log "验证部署..."

  # 1. systemd 状态
  log "  [1/4] systemd 状态"
  ssh "$SSH_ALIAS" "systemctl is-active $SERVICE" | grep -q active \
    && log "  ✓ $SERVICE active" \
    || { err "  ✗ $SERVICE 未运行"; exit 1; }

  # 2. PB health
  log "  [2/4] PocketBase health"
  local health=$(ssh "$SSH_ALIAS" "curl -s http://127.0.0.1:$PB_PORT/api/health")
  echo "$health" | grep -q '"code":200' \
    && log "  ✓ PB API 健康" \
    || { err "  ✗ PB API 异常: $health"; exit 1; }

  # 3. HTTPS 首页
  log "  [3/4] HTTPS 首页"
  local http_code=$(curl -s -o /dev/null -w '%{http_code}' "$DOMAIN")
  [ "$http_code" = "200" ] \
    && log "  ✓ $DOMAIN → 200" \
    || { err "  ✗ $DOMAIN → $http_code"; exit 1; }

  # 4. HTTPS API
  log "  [4/4] HTTPS API health"
  local api_code=$(curl -s -o /dev/null -w '%{http_code}' "$DOMAIN/api/health")
  [ "$api_code" = "200" ] \
    && log "  ✓ $DOMAIN/api/health → 200" \
    || { err "  ✗ $DOMAIN/api/health → $api_code"; exit 1; }

  log "全部验证通过 ✅"
}

# ---------- 主流程 ----------
main() {
  log "=== GEO Studio 部署开始 (mode=$MODE) ==="
  check_prereq

  case "$MODE" in
    all)
      build_frontend
      sync_frontend
      sync_backend
      restart_pb
      verify
      ;;
    frontend)
      build_frontend
      sync_frontend
      verify
      ;;
    backend)
      sync_backend
      restart_pb
      verify
      ;;
    check)
      verify
      ;;
  esac

  log "=== 部署完成 ==="
}

main
