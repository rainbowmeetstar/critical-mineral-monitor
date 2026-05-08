from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.mineral import Mineral, MineralPrice
from ..models.news import NewsArticle

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    mineral_count = (await db.execute(select(func.count(Mineral.id)))).scalar()
    news_count = (await db.execute(select(func.count(NewsArticle.id)))).scalar()
    price_count = (await db.execute(select(func.count(MineralPrice.id)))).scalar()

    recent_news = (
        await db.execute(
            select(NewsArticle).order_by(desc(NewsArticle.published_at)).limit(5)
        )
    ).scalars().all()

    minerals_with_prices = (
        await db.execute(
            select(Mineral).join(MineralPrice, isouter=False).distinct()
        )
    ).scalars().all()

    category_counts_result = await db.execute(
        select(NewsArticle.category, func.count(NewsArticle.id))
        .group_by(NewsArticle.category)
    )
    category_counts = {row[0]: row[1] for row in category_counts_result}

    return {
        "minerals_tracked": mineral_count,
        "news_articles": news_count,
        "price_records": price_count,
        "minerals_with_price_data": len(minerals_with_prices),
        "news_by_category": category_counts,
        "recent_news": [
            {
                "id": a.id,
                "title": a.title,
                "source": a.source,
                "category": a.category,
                "published_at": a.published_at.isoformat() if a.published_at else None,
            }
            for a in recent_news
        ],
    }
