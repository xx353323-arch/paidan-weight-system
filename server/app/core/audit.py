import json
from typing import Any

from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.models import AuditLog


def write_audit(
    db: Session,
    actor: CurrentUser | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    summary: str | None = None,
    before: Any = None,
    after: Any = None,
    period_id: int | None = None,
    ip: str | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor.id if actor else None,
            actor_name=actor.display_name if actor else "系统",
            action=action,
            target_type=target_type,
            target_id=target_id,
            period_id=period_id,
            summary=summary,
            before_json=json.dumps(before, ensure_ascii=False, default=str) if before is not None else None,
            after_json=json.dumps(after, ensure_ascii=False, default=str) if after is not None else None,
            ip=ip,
        )
    )
