import csv
import io
import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.mineral import Mineral, MineralPrice
from ..models.news import NewsArticle

router = APIRouter(prefix="/export", tags=["export"])


def _csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    if not rows:
        content = ""
    else:
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        content = buf.getvalue()
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/minerals")
async def export_minerals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mineral).order_by(Mineral.category, Mineral.name))
    minerals = result.scalars().all()
    rows = [
        {
            "id": m.id,
            "name": m.name,
            "name_zh": m.name_zh or "",
            "symbol": m.symbol or "",
            "category": m.category or "",
            "subcategory": m.subcategory or "",
            "atomic_number": m.atomic_number or "",
            "criticality_score": m.criticality_score or "",
            "price_unit": m.price_unit or "",
            "top_producers": "; ".join(m.top_producers or []),
            "key_uses": "; ".join(m.key_uses or []),
        }
        for m in minerals
    ]
    return _csv_response(rows, "minerals.csv")


@router.get("/prices")
async def export_prices(
    mineral_id: int | None = Query(None),
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(MineralPrice, Mineral.name, Mineral.symbol)
        .join(Mineral, MineralPrice.mineral_id == Mineral.id)
        .where(MineralPrice.timestamp >= since)
        .order_by(desc(MineralPrice.timestamp))
    )
    if mineral_id:
        q = q.where(MineralPrice.mineral_id == mineral_id)
    result = await db.execute(q)
    rows = [
        {
            "timestamp": str(row.MineralPrice.timestamp),
            "mineral": row.name,
            "symbol": row.symbol or "",
            "price": row.MineralPrice.price,
            "price_change_pct": row.MineralPrice.price_change_pct or "",
            "unit": row.MineralPrice.unit or "",
            "source": row.MineralPrice.source or "",
        }
        for row in result.all()
    ]
    return _csv_response(rows, "prices.csv")


@router.get("/news")
async def export_news(
    category: str | None = Query(None),
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(NewsArticle)
        .where(NewsArticle.published_at >= since)
        .order_by(desc(NewsArticle.published_at))
    )
    if category:
        q = q.where(NewsArticle.category == category)
    result = await db.execute(q)
    articles = result.scalars().all()
    rows = [
        {
            "published_at": str(a.published_at or ""),
            "title": a.title,
            "source": a.source or "",
            "category": a.category or "",
            "level": a.level or "",
            "country": a.country or "",
            "minerals_mentioned": "; ".join(a.minerals_mentioned or []),
            "url": a.url or "",
            "summary": (a.summary or "").replace("\n", " "),
        }
        for a in articles
    ]
    return _csv_response(rows, "news.csv")
