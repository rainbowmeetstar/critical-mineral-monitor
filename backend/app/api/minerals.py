from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models.mineral import Mineral, MineralPrice
from ..schemas.mineral import MineralOut, MineralDetail, PriceHistory, PriceOut

router = APIRouter(prefix="/minerals", tags=["minerals"])


@router.get("", response_model=list[MineralOut])
async def list_minerals(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Mineral)
    if category:
        q = q.where(Mineral.category == category)
    q = q.order_by(Mineral.category, Mineral.criticality_score.desc())
    result = await db.execute(q)
    minerals = result.scalars().all()

    out = []
    for m in minerals:
        price_q = await db.execute(
            select(MineralPrice)
            .where(MineralPrice.mineral_id == m.id)
            .order_by(desc(MineralPrice.timestamp))
            .limit(1)
        )
        latest = price_q.scalar_one_or_none()
        mineral_out = MineralOut.model_validate(m)
        mineral_out.latest_price = PriceOut.model_validate(latest) if latest else None
        out.append(mineral_out)
    return out


@router.get("/{mineral_id}", response_model=MineralDetail)
async def get_mineral(mineral_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mineral).where(Mineral.id == mineral_id))
    mineral = result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(status_code=404, detail="Mineral not found")

    price_q = await db.execute(
        select(MineralPrice)
        .where(MineralPrice.mineral_id == mineral.id)
        .order_by(desc(MineralPrice.timestamp))
        .limit(1)
    )
    latest = price_q.scalar_one_or_none()
    out = MineralDetail.model_validate(mineral)
    out.latest_price = PriceOut.model_validate(latest) if latest else None
    return out


@router.get("/{mineral_id}/prices", response_model=PriceHistory)
async def get_price_history(
    mineral_id: int,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Mineral).where(Mineral.id == mineral_id))
    mineral = result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(status_code=404, detail="Mineral not found")

    since = datetime.utcnow() - timedelta(days=days)
    prices_q = await db.execute(
        select(MineralPrice)
        .where(MineralPrice.mineral_id == mineral_id, MineralPrice.timestamp >= since)
        .order_by(MineralPrice.timestamp)
    )
    prices = prices_q.scalars().all()

    return PriceHistory(
        mineral_id=mineral.id,
        mineral_name=mineral.name,
        symbol=mineral.symbol,
        unit=mineral.price_unit,
        prices=[PriceOut.model_validate(p) for p in prices],
    )
