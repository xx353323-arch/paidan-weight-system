#!/bin/zsh
for p in 8000 8001; do
  pid=$(lsof -nP -tiTCP:$p -sTCP:LISTEN 2>/dev/null)
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null && echo "已停止端口 $p"
  else
    echo "端口 $p 未运行"
  fi
done
echo ""
echo "如需卸载开发磁盘映像，执行 hdiutil detach /Volumes/PaidanDev"
read "?按回车关闭"
