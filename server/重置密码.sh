#!/bin/zsh
if [ -z "$1" ]; then
  echo "用法: ./重置密码.sh 账号"
  echo "例如: ./重置密码.sh xiaoxin"
  echo ""
  echo "把指定账号的密码重置回拼音初始值，下次登录会强制改密。"
  exit 1
fi
cd "$(dirname "$0")"
.venv/bin/python -c "
import sys
from app.db.session import SessionLocal
from app.models import SysUser
from app.core.security import hash_password
from sqlalchemy import select
username = '$1'
db = SessionLocal()
user = db.scalar(select(SysUser).where(SysUser.username == username))
if not user:
    print(f'账号 {username} 不存在')
    sys.exit(1)
user.password_hash = hash_password(username)
user.must_change_pwd = True
user.status = 'active'
db.commit()
print(f'{user.display_name}（{username}）的密码已重置为 {username}，下次登录会要求改密')
db.close()
"
