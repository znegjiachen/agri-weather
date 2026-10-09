#!/bin/bash
# =============================================
# 智慧农业天气系统 — 传统部署脚本（不用 Docker）
# =============================================
# 使用方法：
#   1. 先在服务器上执行一次 setup 初始化目录和配置
#   2. 每次更新代码后执行 deploy 发布
#
#   chmod +x deploy.sh
#   ./deploy.sh setup     # 首次初始化
#   ./deploy.sh deploy    # 发布更新
# =============================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="/opt/agri-weather"
WWW_DIR="/var/www/agri-weather"
SERVICE_NAME="agri-weather"

# ---------- 颜色输出 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ==================== 初始化 ====================
setup() {
    log "开始首次部署初始化..."

    # 1. 检查 Java
    if ! command -v java &> /dev/null; then
        fail "请先安装 Java 17: sudo apt install openjdk-17-jre"
    fi
    log "Java 版本: $(java -version 2>&1 | head -1)"

    # 2. 检查 MySQL
    if ! command -v mysql &> /dev/null; then
        warn "未检测到 MySQL，请手动安装: sudo apt install mysql-server"
    fi

    # 3. 检查 Nginx
    if ! command -v nginx &> /dev/null; then
        warn "未检测到 Nginx，正在安装..."
        sudo apt update && sudo apt install -y nginx
    fi
    log "Nginx 已就绪"

    # 4. 创建目录结构
    sudo mkdir -p "$APP_DIR" "$WWW_DIR"
    sudo chown -R "$USER:$USER" "$APP_DIR"

    # 5. 初始化数据库（需要 MySQL 先运行）
    if command -v mysql &> /dev/null; then
        warn "请输入 MySQL root 密码以创建数据库:"
        mysql -u root -p < "$PROJECT_DIR/agri-weather-server/sql/schema.sql" 2>/dev/null && \
            log "数据库初始化完成" || \
            warn "数据库可能已存在，跳过建库"
    fi

    # 6. 配置 systemd 服务
    sudo cp "$PROJECT_DIR/agri-weather.service" /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    log "systemd 服务已注册"

    # 7. 配置 Nginx
    sudo cp "$PROJECT_DIR/nginx.conf" /etc/nginx/sites-available/agri-weather
    sudo ln -sf /etc/nginx/sites-available/agri-weather /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl reload nginx
    log "Nginx 配置完成"

    echo ""
    log "初始化完成！请编辑 systemd 服务文件填入真实密码："
    warn "  sudo vi /etc/systemd/system/agri-weather.service"
    warn "  修改 Environment 行中的 DB_PASSWORD 和 JWT_SECRET"
    warn "  然后执行: sudo systemctl daemon-reload && sudo systemctl start agri-weather"
}

# ==================== 部署更新 ====================
deploy() {
    log "开始部署..."

    # 1. 构建前端
    log "构建前端..."
    cd "$PROJECT_DIR/weather-app-react"
    npm install --silent
    npm run build
    log "前端构建完成"

    # 2. 部署前端文件
    sudo rm -rf "$WWW_DIR"/*
    sudo cp -r dist/* "$WWW_DIR/"
    sudo chown -R www-data:www-data "$WWW_DIR"
    log "前端文件已部署到 $WWW_DIR"

    # 3. 构建后端
    log "构建后端..."
    cd "$PROJECT_DIR/agri-weather-server"
    ./mvnw package -DskipTests -q
    log "后端打包完成"

    # 4. 部署后端
    JAR_FILE=$(ls target/*.jar | head -1)
    cp "$JAR_FILE" "$APP_DIR/agri-weather-server.jar"
    log "后端 JAR 已部署到 $APP_DIR"

    # 5. 重启后端服务
    sudo systemctl restart "$SERVICE_NAME"
    log "后端服务已重启"

    # 6. 重载 Nginx
    sudo systemctl reload nginx
    log "Nginx 已重载"

    echo ""
    log "部署完成！"
    echo "  检查后端状态: sudo systemctl status agri-weather"
    echo "  查看日志:      sudo journalctl -u agri-weather -f"
}

# ==================== 入口 ====================
case "${1:-deploy}" in
    setup)  setup ;;
    deploy) deploy ;;
    *)      echo "用法: $0 {setup|deploy}" ;;
esac
