#!/bin/zsh
cd "$(dirname "$0")"
if [ "$1" != "--yes" ]; then
  echo "这会清空所有评价数据，恢复到初始状态："
  echo "  删除 所有打分记录、跑批结果、权重快照、人工调权、告警、审计日志、登录令牌"
  echo "  删除 所有评价周期，并重建一个当月的空周期"
  echo "  重置 全部账号密码为拼音，首次登录强制改密，清空最后登录时间"
  echo "  整理 数据库文件，把变更落盘并回收空间"
  echo ""
  echo "保留：人员档案、标签、主管归属关系、算法配置"
  echo ""
  echo "确认执行请加参数：./重置系统.sh --yes"
  exit 0
fi
.venv/bin/python -c "
from datetime import datetime
from sqlalchemy import delete, select, func, text
from app.db.session import SessionLocal, engine
from app.core.security import hash_password
from app.core.constants import PeriodStatus
from app.models import (
    AlgoConfig, AuditLog, EvalItemScore, EvalPeriod, EvalSubmission, SnapshotAdjustmentLink,
    SysRefreshToken, SysSetting, SysUser, WeightAdjustment, WeightAlert, WeightRoleBlock,
    WeightRun, WeightSnapshot, Employee, Tag, EvalRelation,
)

db = SessionLocal()
for model in (SnapshotAdjustmentLink, WeightAdjustment, WeightRoleBlock, WeightAlert,
              WeightSnapshot, WeightRun, EvalItemScore, EvalSubmission, EvalPeriod,
              AuditLog, SysRefreshToken, SysSetting):
    db.execute(delete(model))

reset = 0
for user in db.scalars(select(SysUser)):
    user.password_hash = hash_password(user.username)
    user.must_change_pwd = user.username != 'test'
    user.status = 'active'
    user.last_login_at = None
    reset += 1

config = db.scalar(select(AlgoConfig).where(AlgoConfig.status == 'active'))
today = datetime.now()
code = f'{today.year}-{today.month:02d}'
period = EvalPeriod(
    code=code, year=today.year, month=today.month,
    status=PeriodStatus.DRAFT, config_id=config.id if config else None,
)
db.add(period)
db.commit()

employees = db.scalar(select(func.count()).select_from(Employee))
tags = db.scalar(select(func.count()).select_from(Tag))
relations = db.scalar(select(func.count()).select_from(EvalRelation))
users = db.scalar(select(func.count()).select_from(SysUser))
db.close()

with engine.connect() as conn:
    conn.execute(text('PRAGMA wal_checkpoint(TRUNCATE)'))
    conn.commit()
    try:
        conn.execute(text('VACUUM'))
        conn.commit()
        vacuumed = True
    except Exception:
        vacuumed = False

print(f'已重置 {reset} 个账号的密码为拼音初始值')
print(f'已清空全部评价数据，新建空周期 {code}（草稿状态，需在周期管理页开启）')
print('变更已落盘' + ('，数据库文件已整理回收' if vacuumed else '（数据库整理跳过，服务占用中，可停服后手动执行 VACUUM）'))
print()
print('保留的基础数据：')
print(f'  编辑 {employees} 人 ｜ 标签 {tags} 个 ｜ 主管归属关系 {relations} 条 ｜ 账号 {users} 个')
"
