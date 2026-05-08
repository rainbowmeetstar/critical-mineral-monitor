"""
News crawler pulling from RSS feeds covering mining industry, policies, and markets.
Sources: Mining.com, Kitco, Reuters Business, IEA, Mining Weekly.
"""
import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import feedparser
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal
from ..models.news import NewsArticle
from .base import BaseCrawler

logger = logging.getLogger(__name__)

RSS_SOURCES = [
    {
        "url": "https://mining.com/feed/",
        "source": "Mining.com",
        "category": "industry",
        "level": "industry_assoc",
        "country": "Global",
    },
    {
        "url": "https://www.kitco.com/rss/kitconews.xml",
        "source": "Kitco News",
        "category": "price",
        "level": "industry_assoc",
        "country": "Global",
    },
    {
        "url": "https://www.miningweekly.com/rss/",
        "source": "Mining Weekly",
        "category": "industry",
        "level": "industry_assoc",
        "country": "Global",
    },
    {
        "url": "https://rss.app/feeds/BzLVYAmpJWuiFmhQ.xml",
        "source": "IEA Critical Minerals",
        "category": "policy",
        "level": "government",
        "country": "International",
    },
    {
        "url": "https://feeds.reuters.com/reuters/businessNews",
        "source": "Reuters Business",
        "category": "industry",
        "level": "industry_assoc",
        "country": "Global",
    },
]

# Keywords to detect mineral mentions in articles
MINERAL_KEYWORDS = {
    "Lithium": ["lithium", "li-ion", "lithium carbonate", "spodumene"],
    "Cobalt": ["cobalt"],
    "Nickel": ["nickel"],
    "Copper": ["copper"],
    "Neodymium": ["neodymium", "ndfeb", "neomagnet"],
    "Dysprosium": ["dysprosium"],
    "Terbium": ["terbium"],
    "Rare Earth": ["rare earth", "REE", "rare-earth", "LREE", "HREE"],
    "Platinum": ["platinum", "PGM", "platinum group"],
    "Palladium": ["palladium"],
    "Manganese": ["manganese"],
    "Graphite": ["graphite", "anode material"],
    "Vanadium": ["vanadium"],
    "Gallium": ["gallium"],
    "Germanium": ["germanium"],
    "Tungsten": ["tungsten"],
    "Molybdenum": ["molybdenum"],
}


def detect_minerals(text: str) -> list[str]:
    text_lower = text.lower()
    found = []
    for mineral, keywords in MINERAL_KEYWORDS.items():
        if any(kw.lower() in text_lower for kw in keywords):
            found.append(mineral)
    return found


def parse_date(entry) -> Optional[datetime]:
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                dt = parsedate_to_datetime(raw)
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            except Exception:
                pass
    return datetime.utcnow()


class NewsCrawler(BaseCrawler):
    name = "news_rss"

    async def fetch(self) -> dict:
        saved = 0
        skipped = 0

        async with AsyncSessionLocal() as db:
            for source_cfg in RSS_SOURCES:
                try:
                    articles = await self._fetch_feed(source_cfg)
                    for article_data in articles:
                        result = await self._save_article(db, article_data)
                        if result:
                            saved += 1
                        else:
                            skipped += 1
                except Exception as e:
                    logger.warning(f"Feed error [{source_cfg['source']}]: {e}")

            await db.commit()

        return {"success": True, "saved": saved, "skipped_duplicates": skipped}

    async def _fetch_feed(self, cfg: dict) -> list[dict]:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            try:
                resp = await client.get(cfg["url"])
                resp.raise_for_status()
                content = resp.text
            except Exception as e:
                logger.warning(f"HTTP error for {cfg['url']}: {e}")
                return []

        feed = feedparser.parse(content)
        articles = []

        for entry in feed.entries[:20]:
            title = entry.get("title", "").strip()
            url = entry.get("link", "").strip()
            summary = re.sub(r"<[^>]+>", "", entry.get("summary", "")).strip()

            if not title or not url:
                continue

            minerals = detect_minerals(title + " " + summary)

            articles.append({
                "title": title[:500],
                "url": url[:1000],
                "source": cfg["source"],
                "category": cfg["category"],
                "level": cfg["level"],
                "country": cfg["country"],
                "published_at": parse_date(entry),
                "summary": summary[:2000] if summary else None,
                "minerals_mentioned": minerals,
            })

        return articles

    async def _save_article(self, db: AsyncSession, data: dict) -> bool:
        existing = await db.execute(
            select(NewsArticle).where(NewsArticle.url == data["url"])
        )
        if existing.scalar_one_or_none():
            return False

        article = NewsArticle(**data)
        db.add(article)
        return True
