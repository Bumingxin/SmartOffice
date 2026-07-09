#!/bin/bash
set -e

# Configuration
# If not in a project dir, default to ~/SmartOffice
INSTALL_DIR="$HOME/SmartOffice"

# 配置选项
ENABLE_GITEE_FALLBACK=${ENABLE_GITEE_FALLBACK:-true}

# 配置常量
GITHUB_URL="https://github.com/Bumingxin/SmartOffice.git"
GITEE_URL="https://gitee.com/bumingxin/SmartOffice.git"

emit_phase() {
    echo "::clawui-update-phase::$1"
}

# 网络连通性检测函数
check_network() {
    local url=$1
    local timeout=5
    
    # 使用 curl 测试连接
    if curl -s --connect-timeout $timeout --max-time $timeout "$url" > /dev/null 2>&1; then
        return 0  # 成功
    else
        return 1  # 失败
    fi
}

# 添加 Gitee 备用远程仓库
setup_backup_remote() {
    # 检查是否已添加 gitee 远程仓库
    if ! git remote get-url gitee > /dev/null 2>&1; then
        echo "添加 Gitee 备用远程仓库..."
        git remote add gitee "$GITEE_URL"
    fi
}

# 获取代码（带回退逻辑）
fetch_code() {
    echo "检测网络连通性..."
    
    # 尝试 GitHub
    if check_network "$GITHUB_URL"; then
        echo "GitHub 可用，从 GitHub 拉取..."
        git fetch origin main --tags
        return 0
    fi
    
    # 尝试 Gitee
    echo "GitHub 不可用，尝试 Gitee..."
    setup_backup_remote
    
    if check_network "$GITEE_URL"; then
        echo "Gitee 可用，从 Gitee 拉取..."
        git fetch gitee main --tags
        # 将 gitee 的 main 分支重置为本地的 main
        git reset --hard gitee/main
        return 0
    fi
    
    # 都不可用
    echo "错误：GitHub 和 Gitee 都不可用"
    return 1
}

if [ -f "deploy-release.sh" ]; then
    PROJECT_ROOT="$(pwd)"
elif [ -d "$INSTALL_DIR" ]; then
    PROJECT_ROOT="$INSTALL_DIR"
else
    echo "Error: Could not find SmartOffice installation."
    echo "Checked: $(pwd) and $INSTALL_DIR"
    exit 1
fi

SERVICE_DIR="$HOME/.config/systemd/user"

echo "================================================"
echo "   SmartOffice - 更新脚本"
echo "================================================"

# 1. 从服务文件中探测现有端口
emit_phase "detect-service"
EXISTING_PORT=""
SERVICES=$(ls $SERVICE_DIR/clawui-*.service 2>/dev/null | sort -V || true)

if [ -n "$SERVICES" ]; then
    # 使用找到的第一个服务端口作为默认值
    FIRST_SERVICE=$(echo "$SERVICES" | head -n 1)
    EXISTING_PORT=$(basename "$FIRST_SERVICE" | sed 's/clawui-\([0-9]*\)\.service/\1/')
    echo "检测到正在运行的端口: $EXISTING_PORT"
else
    # 检查旧版服务文件
    if [ -f "$SERVICE_DIR/clawui.service" ]; then
        EXISTING_PORT="3456"
        echo "检测到旧版安装 (端口 3456)"
    fi
fi

TARGET_PORT=${1:-$EXISTING_PORT}
TARGET_PORT=${TARGET_PORT:-3456}

emit_phase "git-pull"
echo "正在同步代码，目录: $PROJECT_ROOT..."
cd "$PROJECT_ROOT"

# 使用带回退逻辑的获取函数
fetch_code

# 如果从 Gitee 拉取，需要特殊处理
if git remote get-url gitee > /dev/null 2>&1 && \
   ! check_network "$GITHUB_URL" && \
   check_network "$GITEE_URL"; then
    echo "从 Gitee 同步完成"
    git reset --hard gitee/main
else
    git reset --hard origin/main
fi

git clean -fd

emit_phase "deploy-release"
echo "开始升级端口 $TARGET_PORT 的服务..."
chmod +x deploy-release.sh
./deploy-release.sh "$TARGET_PORT"

emit_phase "complete"
echo "================================================"
echo "升级完成！"
echo "您的配置和数据已保留。"
echo "================================================"