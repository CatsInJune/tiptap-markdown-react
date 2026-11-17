#!/usr/bin/env bash
# 阿里云 ECS「构建部署」(OOS) 自定义脚本模式用的脚本。
# 用法：控制台 ECS 实例详情页 -> 定时与自动化任务 -> 构建部署 -> 创建执行，
#       代码源选择 GitHub/Gitee 仓库（或上传 zip），构建部署配置选
#       「未使用 Docker」自定义脚本模式，把本文件整段粘贴进去。
# 脚本由云助手以 root 身份在拉取下来的代码根目录中执行。
set -euo pipefail

SITE_DIR=/var/www/tiptap-markdown-react
NODE_VERSION=v22.14.0
NODE_DIST="node-${NODE_VERSION}-linux-x64"

### 1. 安装 Node.js（已装则跳过；走阿里云镜像，境内 ECS 速度快）
if ! command -v node >/dev/null 2>&1; then
  echo "==> 安装 Node.js ${NODE_VERSION}"
  curl -fsSL "https://mirrors.aliyun.com/nodejs-release/${NODE_VERSION}/${NODE_DIST}.tar.xz" \
    -o /tmp/node.tar.xz
  mkdir -p /usr/local/lib/nodejs
  tar -xJf /tmp/node.tar.xz -C /usr/local/lib/nodejs
  ln -sf "/usr/local/lib/nodejs/${NODE_DIST}/bin/node" /usr/local/bin/node
  ln -sf "/usr/local/lib/nodejs/${NODE_DIST}/bin/npm" /usr/local/bin/npm
  ln -sf "/usr/local/lib/nodejs/${NODE_DIST}/bin/npx" /usr/local/bin/npx
  rm -f /tmp/node.tar.xz
fi
node -v

### 2. npm 依赖走国内镜像
export npm_config_registry=https://registry.npmmirror.com

### 3. 构建库
echo "==> 构建库"
npm ci
npm run build

### 4. site 通过 file:.. 依赖库的构建产物，必须在库构建完成之后再安装
echo "==> 构建站点"
( cd site && npm ci && npm run build )

### 5. 发布为独立版本目录并切换软链（回滚 = 改软链，无需重新构建）
echo "==> 发布新版本"
command -v rsync >/dev/null 2>&1 || yum install -y rsync
TS=$(date +%Y%m%d%H%M%S)
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo manual)
REL="$SITE_DIR/releases/$TS-$SHA"
mkdir -p "$REL"
rsync -a --chmod=D755,F644 site/dist/ "$REL/"
ln -sfn "$REL" "$SITE_DIR/current"

# 把回滚脚本放到站点目录，方便随时登录服务器回滚
cp deploy/rollback.sh "$SITE_DIR/rollback.sh" 2>/dev/null \
  || echo "!! 未找到 deploy/rollback.sh，跳过"

# 只保留最近 5 个版本
ls -1d "$SITE_DIR/releases"/*/ | sort -r | tail -n +6 | xargs -r rm -rf

# nginx 未安装/未就绪时只提示不中断：站点文件已同步，
# 装好 nginx（deploy/server-setup.sh）后手动 systemctl reload nginx 即可。
nginx -t && systemctl reload nginx \
  || echo "!! nginx 未就绪，已跳过 reload。装好 nginx 后手动执行：systemctl reload nginx"

echo "==> 部署完成：已发布 $(basename "$REL")，地址 http://<ECS公网IP>"
echo "    如需回滚：bash $SITE_DIR/rollback.sh prev"
