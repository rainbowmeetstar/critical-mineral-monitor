from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.alert import PriceAlert, AlertTrigger
from ..models.mineral import Mineral, MineralPrice

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ── Schemas ────────────────────────────────────────────────────────────────

class AlertCreate(BaseModel):
    mineral_id: int
    direction: str          # "above" | "below"
    threshold: float
    note: Optional[str] = None


class AlertOut(BaseModel):
    id: int
    mineral_id: int
    mineral_name: str
    mineral_name_zh: Optional[str]
    direction: str
    threshold: float
    note: Optional[str]
    active: bool
    created_at: datetime
    last_triggered_at: Optional[datetime]
    trigger_count: int

    model_config = {"from_attributes": True}


class TriggerOut(BaseModel):
    id: int
    alert_id: int
    mineral_name: str
    direction: str
    threshold: float
    price_at_trigger: float
    triggered_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[AlertOut])
async def list_alerts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PriceAlert).order_by(desc(PriceAlert.created_at))
    )
    alerts = result.scalars().all()
    out = []
    for a in alerts:
        mineral = await db.get(Mineral, a.mineral_id)
        triggers_q = await db.execute(
            select(AlertTrigger)
            .where(AlertTrigger.alert_id == a.id)
            .order_by(desc(AlertTrigger.triggered_at))
        )
        triggers = triggers_q.scalars().all()
        out.append(AlertOut(
            id=a.id,
            mineral_id=a.mineral_id,
            mineral_name=mineral.name if mineral else "",
            mineral_name_zh=mineral.name_zh if mineral else None,
            direction=a.direction,
            threshold=a.threshold,
            note=a.note,
            active=a.active,
            created_at=a.created_at,
            last_triggered_at=triggers[0].triggered_at if triggers else None,
            trigger_count=len(triggers),
        ))
    return out


@router.post("", response_model=AlertOut, status_code=201)
async def create_alert(body: AlertCreate, db: AsyncSession = Depends(get_db)):
    if body.direction not in ("above", "below"):
        raise HTTPException(400, "direction must be 'above' or 'below'")
    mineral = await db.get(Mineral, body.mineral_id)
    if not mineral:
        raise HTTPException(404, "Mineral not found")
    alert = PriceAlert(
        mineral_id=body.mineral_id,
        direction=body.direction,
        threshold=body.threshold,
        note=body.note,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return AlertOut(
        id=alert.id,
        mineral_id=alert.mineral_id,
        mineral_name=mineral.name,
        mineral_name_zh=mineral.name_zh,
        direction=alert.direction,
        threshold=alert.threshold,
        note=alert.note,
        active=alert.active,
        created_at=alert.created_at,
        last_triggered_at=None,
        trigger_count=0,
    )


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    alert = await db.get(PriceAlert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    await db.delete(alert)
    await db.commit()


@router.get("/triggers", response_model=list[TriggerOut])
async def list_triggers(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(AlertTrigger, PriceAlert, Mineral)
        .join(PriceAlert, AlertTrigger.alert_id == PriceAlert.id)
        .join(Mineral, PriceAlert.mineral_id == Mineral.id)
        .where(AlertTrigger.triggered_at >= since)
        .order_by(desc(AlertTrigger.triggered_at))
        .limit(100)
    )
    return [
        TriggerOut(
            id=row.AlertTrigger.id,
            alert_id=row.AlertTrigger.alert_id,
            mineral_name=row.Mineral.name,
            direction=row.PriceAlert.direction,
            threshold=row.PriceAlert.threshold,
            price_at_trigger=row.AlertTrigger.price_at_trigger,
            triggered_at=row.AlertTrigger.triggered_at,
        )
        for row in result.all()
    ]
