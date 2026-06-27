#!/bin/bash
# GEO Studio — 一键启动脚本
# 同时启动 PocketBase 后端（8085）和 Vite 前端（5175）

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PB_DIR="$SCRIPT_DIR/pocketbase"
PB_DATA="$PB_DIR/pb_data"
PB_BIN="$PB_DIR/pocketbase"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "=========================================="
echo "  GEO Studio 启动脚本"
echo "=========================================="
echo ""

# ---- 1. 检查/下载 PocketBase ----
if [ ! -f "$PB_BIN" ]; then
  echo "📦 PocketBase 未找到，正在下载..."
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then ARCH="arm64"; else ARCH="amd64"; fi
  PB_VERSION="0.22.21"
  PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip"
  mkdir -p "$PB_DIR"
  curl -L --connect-timeout 30 --max-time 300 -o "$PB_DIR/pb.zip" "$PB_URL"
  unzip -o "$PB_DIR/pb.zip" -d "$PB_DIR"
  rm "$PB_DIR/pb.zip"
  chmod +x "$PB_BIN"
  echo "✅ PocketBase 下载完成"
fi

# ---- 2. 首次运行：创建管理员 ----
if [ ! -d "$PB_DATA" ]; then
  echo "🔧 首次运行，创建管理员账号..."
  "$PB_BIN" superuser upsert "admin@geo.local" "admin123456" --dir="$PB_DATA"
fi

# ---- 3. 启动 PocketBase ----
echo "🚀 启动 PocketBase (端口 8085)..."
"$PB_BIN" serve --http=127.0.0.1:8085 --dir="$PB_DATA" &
PB_PID=$!
sleep 2

# 验证 PocketBase
if curl -s http://127.0.0.1:8085/api/health > /dev/null 2>&1; then
  echo "✅ PocketBase 已启动: http://127.0.0.1:8085"
  echo "   管理面板: http://127.0.0.1:8085/_/"
else
  echo "❌ PocketBase 启动失败"
  kill $PB_PID 2>/dev/null
  exit 1
fi

# ---- 4. 安装前端依赖（首次） ----
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "📦 安装前端依赖..."
  cd "$FRONTEND_DIR"
  npm install --registry=https://registry.npmmirror.com
  cd "$SCRIPT_DIR"
fi

# ---- 5. 启动 Vite 前端 ----
echo "🚀 启动 Vite 前端 (端口 5175)..."
cd "$FRONTEND_DIR"
npx vite --port 5175 --strictPort &
VITE_PID=$!
sleep 2
cd "$SCRIPT_DIR"

# 验证 Vite
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5175/ | grep -q "200"; then
  echo "✅ Vite 已启动: http://localhost:5175"
else
  echo "❌ Vite 启动失败"
  kill $PB_PID $VITE_PID 2>/dev/null
  exit 1
fi

echo ""
echo "=========================================="
echo "  🎉 GEO Studio 启动完成！"
echo ""
echo "  前端: http://localhost:5175"
echo "  后端: http://127.0.0.1:8085"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "=========================================="

# ---- 6. 等待退出信号 ----
trap "echo ''; echo '正在停止服务...'; kill $PB_PID $VITE_PID 2>/dev/null; exit 0" INT TERM
wait
