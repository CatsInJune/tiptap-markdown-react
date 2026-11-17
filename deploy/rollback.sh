#!/usr/bin/env bash
# 站点版本回滚脚本（在 ECS 上执行）。
# 每次部署都会生成 /var/www/tiptap-markdown-react/releases/<时间戳>-<commit>，
# nginx 通过 current 软链指向当前版本；回滚 = 改软链指向，无需重新构建。
#
# 用法：
#   bash rollback.sh                # 查看当前版本和全部可用版本
#   bash rollback.sh prev           # 回滚到上一个版本（最常用）
#   bash rollback.sh 20261117       # 回滚到目录名以此为唯一前缀的版本
#   bash rollback.sh 20261117093000-abc1234   # 回滚到指定版本（完整目录名）
set -euo pipefail

BASE=/var/www/tiptap-markdown-react
RELEASES="$BASE/releases"
CURRENT="$BASE/current"

list_newest_first() {
  ls -1d "$RELEASES"/*/ 2>/dev/null | sort -r
}

if [[ $# -eq 0 ]]; then
  echo "当前版本：$(basename "$(readlink "$CURRENT" 2>/dev/null || echo '未部署')")"
  echo ""
  echo "可用版本（新 → 旧）："
  list_newest_first
  echo ""
  echo "用法：bash rollback.sh prev        # 回到上一个版本"
  echo "      bash rollback.sh <目录名或唯一前缀>"
  exit 0
fi

TARGET="$1"
TARGET_DIR=""

if [[ "$TARGET" == "prev" ]]; then
  cur=$(basename "$(readlink "$CURRENT" 2>/dev/null)" || true)
  prev=""
  found=0
  while IFS= read -r d; do
    if [[ $found -eq 1 ]]; then prev="$d"; break; fi
    if [[ "$(basename "$d")" == "$cur" ]]; then found=1; fi
  done < <(list_newest_first)
  if [[ -z "$prev" ]]; then
    echo "!! 没有更早的版本可回滚"
    exit 1
  fi
  TARGET_DIR="$prev"
else
  matches=()
  while IFS= read -r d; do
    [[ -d "$d" ]] && matches+=("$d")
  done < <(compgen -G "$RELEASES/${TARGET}*" || true)
  if [[ ${#matches[@]} -eq 0 ]]; then
    echo "!! 找不到匹配 '$TARGET' 的版本。可用版本："
    list_newest_first
    exit 1
  fi
  if [[ ${#matches[@]} -gt 1 ]]; then
    echo "!! 前缀 '$TARGET' 匹配到多个版本，请写完整目录名："
    printf '  %s\n' "${matches[@]##*/}"
    exit 1
  fi
  TARGET_DIR="${matches[0]}"
fi

echo "回滚：$(basename "$(readlink "$CURRENT" 2>/dev/null)" || echo 未部署) -> $(basename "$TARGET_DIR")"
ln -sfn "$TARGET_DIR" "$CURRENT"
systemctl reload nginx 2>/dev/null || true
echo "完成：现在对外服务的是 $(basename "$TARGET_DIR")，刷新页面即可验证。"
