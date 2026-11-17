#!/usr/bin/env bash
# 在阿里云 ECS 上以 root 执行一次：装 nginx/rsync、建版本目录、启动 nginx。
# 之后的 nginx 配置和站点文件都由部署流程自动同步，无需再登录服务器。
#
# 用法（服务器上）：
#   bash server-setup.sh
set -euo pipefail

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx rsync
else
  yum install -y nginx rsync
fi

# 版本目录结构：releases/<时间戳>-<commit> 为各次部署，current 软链指向当前版本
mkdir -p /var/www/tiptap-markdown-react/releases

systemctl enable --now nginx
systemctl status nginx --no-pager | head -n 3

echo ""
echo "==> 初始化完成。"
echo "    下一步：确认安全组已放行入方向 TCP 80/443，然后触发一次部署"
echo "    （GitHub Actions 手动执行，或控制台构建部署执行）。"
