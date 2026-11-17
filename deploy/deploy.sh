#!/usr/bin/env bash
# 本地构建 site/dist，再发布为 ECS 上的一个新版本目录并切换 current 软链。
# 每次部署保留独立版本，回滚见 deploy/rollback.sh（会被同步到服务器）。
#
# 首次使用：
#   1) 改下面的 SERVER / REMOTE_DIR（或每次用环境变量覆盖）
#   2) 确保本机已能免密 SSH：ssh-copy-id root@<ip>
#   3) 服务器上已跑过 deploy/server-setup.sh，nginx.conf 已就位
#
# 用法：
#   ./deploy/deploy.sh                 # 构建并发布新版本
#   SKIP_BUILD=1 ./deploy/deploy.sh    # 只同步已有产物
#   SERVER=deploy@1.2.3.4 ./deploy/deploy.sh
set -euo pipefail

SERVER="${SERVER:-root@your-ecs-ip}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/tiptap-markdown-react}"
SSH_PORT="${SSH_PORT:-22}"
SKIP_BUILD="${SKIP_BUILD:-0}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

cd "$(dirname "$0")/.."

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "==> 构建库"
  npm run build

  echo "==> 构建站点"
  # site 通过 file:.. 依赖库，必须在库构建完之后再装依赖
  if [[ ! -d site/node_modules ]]; then
    ( cd site && npm ci )
  fi
  ( cd site && npm run build )
fi

if [[ ! -f site/dist/index.html ]]; then
  echo "!! site/dist/index.html 不存在，构建可能失败了" >&2
  exit 1
fi

TS=$(date +%Y%m%d%H%M%S)
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo manual)
REL_NAME="$TS-$SHA"
REL_DIR="$REMOTE_DIR/releases/$REL_NAME"

echo "==> 准备远端版本目录 $REL_DIR"
ssh -p "$SSH_PORT" "$SERVER" "mkdir -p '$REL_DIR'"

echo "==> 上传产物到 $SERVER:$REL_DIR"
# site/dist 尾部必带斜杠：同步目录内容而不是目录本身
rsync -avz --chmod=D755,F644 \
  -e "ssh -p $SSH_PORT" \
  site/dist/ "$SERVER:$REL_DIR/"

echo "==> 同步回滚脚本并切换 current 软链"
rsync -avz -e "ssh -p $SSH_PORT" deploy/rollback.sh "$SERVER:$REMOTE_DIR/rollback.sh"
ssh -p "$SSH_PORT" "$SERVER" "
  ln -sfn '$REL_DIR' '$REMOTE_DIR/current' &&
  (nginx -t && systemctl reload nginx) || echo 'nginx 未就绪，已跳过 reload'
  cd '$REMOTE_DIR/releases' && ls -1d */ | sort -r | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
"

echo "==> 完成：已发布版本 $REL_NAME（保留最近 $KEEP_RELEASES 个）"
echo "    回滚：ssh -p $SSH_PORT $SERVER \"bash $REMOTE_DIR/rollback.sh prev\""
