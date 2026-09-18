#!/bin/zsh
IMG="/Volumes/UP/PaidanDev.sparsebundle"
MNT="/Volumes/PaidanDev"

if [ ! -d "$MNT" ]; then
  echo "正在挂载开发磁盘映像"
  hdiutil attach "$IMG" >/dev/null 2>&1
fi
if [ ! -d "$MNT" ]; then
  echo "映像挂载失败，请确认移动硬盘 UP 已连接"
  read "?按回车关闭"
  exit 1
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

mkdir -p "$MNT/logs"

if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "后端已在运行"
else
  cd "$MNT/server" && nohup .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$MNT/logs/server.log" 2>&1 &
  echo "后端启动中"
fi

if lsof -nP -iTCP:8001 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "前端已在运行"
else
  cd "$MNT/admin" && nohup npm run dev > "$MNT/logs/web.log" 2>&1 &
  echo "前端启动中，首次编译约需一分钟"
fi

IP=$(ipconfig getifaddr en0 2>/dev/null || echo localhost)
echo ""
echo "本机访问   http://localhost:8001"
echo "局域网访问 http://$IP:8001"
echo "接口文档   http://localhost:8000/docs"
echo ""
read "?按回车关闭此窗口（服务继续在后台运行）"
