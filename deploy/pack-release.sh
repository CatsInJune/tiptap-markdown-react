#!/usr/bin/env bash
# 把当前代码打包成阿里云 OOS「上传本地代码」用的干净 zip。
# 内容 = git 提交快照（不含 node_modules/dist/.git），正好是 OOS 期望的代码根结构。
#
# 用法：
#   ./deploy/pack-release.sh          # 打包当前 HEAD
#   ./deploy/pack-release.sh main     # 打包指定分支/commit
#
# 产物：/tmp/tiptap-markdown-react-<时间戳>-<短SHA>.zip（并自动在 Finder 中定位）
# 之后在 OOS「创建执行」页选『上传本地代码』上传该 zip，构建脚本粘 deploy/oos-build-deploy.sh。
set -euo pipefail

cd "$(dirname "$0")/.."

REF="${1:-HEAD}"
TS=$(date +%Y%m%d%H%M%S)
SHA=$(git rev-parse --short "$REF" 2>/dev/null || echo manual)
OUT="/tmp/tiptap-markdown-react-${TS}-${SHA}.zip"

git archive --format=zip -o "$OUT" "$REF"

echo "==> 已打包 $REF ($(du -h "$OUT" | cut -f1))"
echo "    文件：$OUT"
echo "    下一步：OOS 控制台「构建部署 → 创建执行」→ 代码源选『上传本地代码』"
echo "    上传该 zip（记得勾选同意存入临时 OSS），构建脚本粘 deploy/oos-build-deploy.sh。"

# macOS 顺手在 Finder 里定位文件，方便上传
open -R "$OUT" 2>/dev/null || true
