# ============================================================
# GEO Studio — 多阶段构建
# 阶段 1：构建前端静态资源
# 阶段 2：PocketBase + 前端静态资源 + 迁移
# ============================================================

# ---- 阶段 1：构建前端 ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 利用 npm 缓存（vite 是 devDependency，不能 --omit=dev，否则 build 会失败）
COPY frontend/package*.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    (npm ci || npm install)

# 复制源码并构建
COPY frontend/ ./
RUN npm run build

# ---- 阶段 2：运行时（PocketBase） ----
FROM alpine:3.24 AS runtime

# 下载 PocketBase（自动识别 amd64 / arm64，支持 x86 与 ARM/Apple Silicon 服务器）
ARG PB_VERSION=0.39.4
RUN apk add --no-cache ca-certificates unzip wget tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    PB_ARCH="amd64" && \
    case "$(uname -m)" in aarch64|arm64) PB_ARCH="arm64" ;; esac && \
    wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /pb && \
    chmod +x /pb/pocketbase && \
    rm /tmp/pb.zip

# 工作目录
WORKDIR /pb

# 复制迁移文件与 JS hooks（AI 代理等）
COPY pocketbase/pb_migrations/ /pb/pb_migrations/
COPY pocketbase/pb_hooks/ /pb/pb_hooks/

# 复制前端构建产物（PocketBase 静态托管）
COPY --from=frontend-builder /app/frontend/dist /pb/pb_public

# 数据卷
VOLUME /pb/pb_data

# 暴露端口（PocketBase 同时服务 API 和静态资源）
EXPOSE 8085

# 启动命令：PocketBase 同时托管 API + 前端
# 静态资源由 pb_public 提供，/api/* 由 PocketBase 处理
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8085", "--dir=/pb/pb_data"]
