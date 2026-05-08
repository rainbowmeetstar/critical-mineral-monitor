"""
USGS Mineral Resources crawler.
Fetches mineral commodity news and data from USGS public pages.
USGS Mineral Resources Program: https://www.usgs.gov/centers/national-minerals-information-center
"""
import logging
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select

from ..database import AsyncSessionLocal
from ..models.news import NewsArticle
from .base import BaseCrawler

logger = logging.getLogger(__name__)

USGS_NEWS_URL = "https://www.usgs.gov/centers/national-minerals-information-center/news-announcements"


class USGSCrawler(BaseCrawler):
    name = "usgs"

    async def fetch(self) -> dict:
        articles = await self._scrape_usgs_news()
        saved = 0

        async with AsyncSessionLocal() as db:
            for data in articles:
                existing = await db.execute(
                    select(NewsArticle).where(NewsArticle.url == data["url"])
                )
                if existing.scalar_one_or_none():
                    continue
                db.add(NewsArticle(**data))
                saved += 1
            await db.commit()

        return {"success": True, "saved": saved}

    async def _scrape_usgs_news(self) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                resp = await client.get(USGS_NEWS_URL)
                resp.raise_for_status()
        except Exception as e:
            logger.warning(f"USGS fetch error: {e}")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        articles = []

        for item in soup.select("article.teaser, div.views-row")[:15]:
            title_el = item.select_one("h3 a, h2 a, .field--name-title a")
            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            href = title_el.get("href", "")
            url = f"https://www.usgs.gov{href}" if href.startswith("/") else href

            date_el = item.select_one("time, .field--name-field-date")
            published_at = None
            if date_el:
                dt_str = date_el.get("datetime") or date_el.get_text(strip=True)
                try:
                    published_at = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                    published_at = published_at.replace(tzinfo=None)
                except Exception:
                    pass

            summary_el = item.select_one(".field--name-body, p")
            summary = summary_el.get_text(strip=True)[:1000] if summary_el else None

            articles.append({
                "title": title[:500],
                "url": url[:1000],
                "source": "USGS NMIC",
                "category": "policy",
                "level": "government",
                "country": "United States",
                "published_at": published_at or datetime.utcnow(),
                "summary": summary,
                "minerals_mentioned": [],
            })

        return articles
