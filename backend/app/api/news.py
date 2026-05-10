from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.news import NewsArticle
from ..schemas.news import NewsArticleOut

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=list[NewsArticleOut])
async def list_news(
    category: Optional[str] = Query(None, description="policy|industry|price|corporate|exploration"),
    level: Optional[str] = Query(None, description="government|industry_assoc|corporate"),
    mineral: Optional[str] = Query(None, description="Filter by mineral name (e.g. Lithium)"),
    country: Optional[str] = None,
    q: Optional[str] = Query(None, description="Keyword search on title and summary"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(NewsArticle)
    if category:
        stmt = stmt.where(NewsArticle.category == category)
    if level:
        stmt = stmt.where(NewsArticle.level == level)
    if country:
        stmt = stmt.where(NewsArticle.country.ilike(f"%{country}%"))
    if q:
        kw = f"%{q}%"
        stmt = stmt.where(or_(NewsArticle.title.ilike(kw), NewsArticle.summary.ilike(kw)))
    stmt = stmt.order_by(desc(NewsArticle.published_at))
    stmt = stmt.offset((page - 1) * limit).limit(limit)

    result = await db.execute(stmt)
    articles = result.scalars().all()

    if mineral:
        articles = [a for a in articles if mineral in (a.minerals_mentioned or [])]

    return [NewsArticleOut.model_validate(a) for a in articles]
