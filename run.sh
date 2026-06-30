#!/bin/bash
# GEO Studio — 项目管理脚本
# 用法: bash run.sh [start|stop|restart]
# 只操作本项目的 PocketBase(8085) 和 Vite(5175)，不影响其他端口

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PB_DIR="$SCRIPT_DIR/pocketbase"
PB_DATA="$PB_DIR/pb_data"
PB_BIN="$PB_DIR/pocketbase"
FE_DIR="$SCRIPT_DIR/frontend"
PID_DIR="$SCRIPT_DIR/.run"
PB_PID_FILE="$PID_DIR/pb.pid"
VITE_PID_FILE="$PID_DIR/vite.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

mkdir -p "$PID_DIR"

# ---- 检查 PocketBase 可执行文件 ----
ensure_pb() {
  if [ ! -f "$PB_BIN" ]; then
    echo -e "${YELLOW}📦 下载 PocketBase...${NC}"
    local os arch
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)
    [ "$arch" = "arm64" ] && arch="arm64" || arch="amd64"
    local ver="0.39.4"
    local url="https://github.com/pocketbase/pocketbase/releases/download/v${ver}/pocketbase_${ver}_${os}_${arch}.zip"
    mkdir -p "$PB_DIR"
    curl -L --connect-timeout 30 --max-time 300 -o "$PB_DIR/pb.zip" "$url"
    unzip -o "$PB_DIR/pb.zip" -d "$PB_DIR"
    rm "$PB_DIR/pb.zip"
    chmod +x "$PB_BIN"
    echo -e "${GREEN}✅ PocketBase 下载完成${NC}"
  fi
  if [ ! -d "$PB_DATA" ]; then
    "$PB_BIN" superuser upsert "admin@geo.local" "admin123456" --dir="$PB_DATA" 2>/dev/null
  fi
}

# ---- 安装前端依赖 ----
ensure_fe() {
  if [ ! -d "$FE_DIR/node_modules" ]; then
    echo -e "${YELLOW}📦 安装前端依赖...${NC}"
    cd "$FE_DIR" && npm install --registry=https://registry.npmmirror.com
    cd "$SCRIPT_DIR"
  fi
}

# ---- 进程是否存活 ----
is_running() {
  local pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# ---- 启动 PocketBase ----
start_pb() {
  if [ -f "$PB_PID_FILE" ] && is_running "$(cat "$PB_PID_FILE")"; then
    echo -e "${YELLOW}⚠️  PocketBase 已在运行 (PID $(cat "$PB_PID_FILE"))${NC}"
    return 1
  fi
  # 确认 8085 端口：如果是 pocketbase 就替掉，否则报错
  local occupier
  occupier=$(lsof -ti :8085 2>/dev/null)
  if [ -n "$occupier" ]; then
    local occ_cmd
    occ_cmd=$(ps -p "$occupier" -o command= 2>/dev/null || "")
    if echo "$occ_cmd" | grep -q "pocketbase"; then
      # 是 pocketbase 进程，无论哪个项目都替掉（8085 就是本项目专用）
      kill "$occupier" 2>/dev/null
      sleep 1
    else
      echo -e "${RED}❌ 端口 8085 被非 PocketBase 进程占用:${NC}"
      ps -p "$occupier" -o pid,command= 2>/dev/null
      return 1
    fi
  fi
  "$PB_BIN" serve --http=127.0.0.1:8085 --dir="$PB_DATA" > /tmp/geo_pb.log 2>&1 &
  local pid=$!
  echo "$pid" > "$PB_PID_FILE"
  sleep 2
  if is_running "$pid" && curl -s http://127.0.0.1:8085/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PocketBase 已启动 (PID $pid, 端口 8085)${NC}"
  else
    echo -e "${RED}❌ PocketBase 启动失败${NC}"
    rm -f "$PB_PID_FILE"
    return 1
  fi
}

# ---- 启动 Vite ----
start_vite() {
  if [ -f "$VITE_PID_FILE" ] && is_running "$(cat "$VITE_PID_FILE")"; then
    echo -e "${YELLOW}⚠️  Vite 已在运行 (PID $(cat "$VITE_PID_FILE"))${NC}"
    return 1
  fi
  local occupier
  occupier=$(lsof -ti :5175 2>/dev/null)
  if [ -n "$occupier" ]; then
    kill "$occupier" 2>/dev/null
    sleep 1
  fi
  cd "$FE_DIR"
  npx vite --port 5175 --strictPort > /tmp/geo_vite.log 2>&1 &
  local pid=$!
  echo "$pid" > "$VITE_PID_FILE"
  cd "$SCRIPT_DIR"
  sleep 2
  if is_running "$pid" && curl -s -o /dev/null -w "%{http_code}" http://localhost:5175/ | grep -q 200; then
    echo -e "${GREEN}✅ Vite 已启动 (PID $pid, 端口 5175)${NC}"
  else
    echo -e "${RED}❌ Vite 启动失败${NC}"
    rm -f "$VITE_PID_FILE"
    return 1
  fi
}

# ---- 停止 PocketBase ----
stop_pb() {
  local pid
  pid=$(cat "$PB_PID_FILE" 2>/dev/null || true)
  if [ -n "$pid" ] && is_running "$pid"; then
    kill "$pid" 2>/dev/null
    sleep 1
    if is_running "$pid"; then
      kill -9 "$pid" 2>/dev/null
      sleep 1
    fi
    echo -e "${GREEN}✅ PocketBase 已停止 (PID $pid)${NC}"
  else
    echo -e "${YELLOW}⚠️  PocketBase 未运行${NC}"
  fi
  rm -f "$PB_PID_FILE"
}

# ---- 停止 Vite ----
stop_vite() {
  local pid
  pid=$(cat "$VITE_PID_FILE" 2>/dev/null || true)
  if [ -n "$pid" ] && is_running "$pid"; then
    kill "$pid" 2>/dev/null
    sleep 1
    if is_running "$pid"; then
      kill -9 "$pid" 2>/dev/null
      sleep 1
    fi
    echo -e "${GREEN}✅ Vite 已停止 (PID $pid)${NC}"
  else
    echo -e "${YELLOW}⚠️  Vite 未运行${NC}"
  fi
  rm -f "$VITE_PID_FILE"
}

# ---- 主命令 ----
case "${1:-start}" in
  start)
    echo -e "${BLUE}🚀 启动 GEO Studio...${NC}"
    echo ""
    ensure_pb
    ensure_fe
    start_pb
    start_vite
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  ${GREEN}GEO Studio 启动完成${NC}"
    echo ""
    echo -e "  ${BLUE}前端  http://localhost:5175${NC}"
    echo -e "  ${BLUE}后端  http://127.0.0.1:8085${NC}"
    echo ""
    echo "  预注册账号: user001 ~ user005"
    echo "  密码: test1234"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ;;

  stop)
    echo -e "${YELLOW}⏹  停止 GEO Studio...${NC}"
    stop_pb
    stop_vite
    ;;

  restart)
    echo -e "${BLUE}🔄 重启 GEO Studio...${NC}"
    stop_pb
    stop_vite
    sleep 1
    echo ""
    ensure_pb
    ensure_fe
    start_pb
    start_vite
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  ${GREEN}GEO Studio 重启完成${NC}"
    echo -e "  ${BLUE}前端  http://localhost:5175${NC}"
    echo -e "  ${BLUE}后端  http://127.0.0.1:8085${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ;;

  status)
    echo "PocketBase: $(if [ -f "$PB_PID_FILE" ] && is_running "$(cat "$PB_PID_FILE")"; then echo -e "${GREEN}运行中 $(cat "$PB_PID_FILE")${NC}"; else echo -e "${RED}已停止${NC}"; fi)"
    echo "Vite:       $(if [ -f "$VITE_PID_FILE" ] && is_running "$(cat "$VITE_PID_FILE")"; then echo -e "${GREEN}运行中 $(cat "$VITE_PID_FILE")${NC}"; else echo -e "${RED}已停止${NC}"; fi)"
    ;;

  *)
    echo "用法: bash run.sh [start|stop|restart|status]"
    echo ""
    echo "  start   启动前端和后端"
    echo "  stop    停止前端和后端"
    echo "  restart 重启前端和后端"
    echo "  status  查看运行状态"
    exit 1
    ;;
esac
