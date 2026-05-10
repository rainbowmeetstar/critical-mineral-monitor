from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.company import Company, CompanySnapshot

router = APIRouter(prefix="/companies", tags=["companies"])


class SnapshotOut(BaseModel):
    stock_price: Optional[float]
    price_change_pct: Optional[float]
    market_cap_usd_bn: Optional[float]
    timestamp: datetime
    model_config = {"from_attributes": True}


class CompanyOut(BaseModel):
    id: int
    name: str
    name_zh: Optional[str]
    ticker: Optional[str]
    exchange: Optional[str]
    country: Optional[str]
    minerals_focus: list[str]
    description: Optional[str]
    description_zh: Optional[str]
    website: Optional[str]
    latest_snapshot: Optional[SnapshotOut]
    model_config = {"from_attributes": True}


@router.get("", response_model=list[CompanyOut])
async def list_companies(
    mineral: Optional[str] = Query(None, description="Filter by mineral name"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).order_by(Company.name))
    companies = result.scalars().all()

    if mineral:
        companies = [c for c in companies if mineral in (c.minerals_focus or [])]

    out = []
    for c in companies:
        snap_q = await db.execute(
            select(CompanySnapshot)
            .where(CompanySnapshot.company_id == c.id)
            .order_by(desc(CompanySnapshot.timestamp))
            .limit(1)
        )
        snap = snap_q.scalar_one_or_none()
        out.append(CompanyOut(
            **{k: getattr(c, k) for k in CompanyOut.model_fields if k != "latest_snapshot"},
            latest_snapshot=SnapshotOut.model_validate(snap) if snap else None,
        ))
    return out
