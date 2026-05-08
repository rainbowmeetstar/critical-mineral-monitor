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

_GN = "https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q="
_GN_ZH = "https://news.google.com/rss/search?hl=zh-CN&gl=CN&ceid=CN:zh-Hans&q="

RSS_SOURCES = [
    # ── Established industry feeds ──
    {
        "url": "https://mining.com/feed/",
        "source": "Mining.com",
        "category": "industry",
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
        "url": "https://www.kitco.com/rss/kitconews.xml",
        "source": "Kitco News",
        "category": "price",
        "level": "industry_assoc",
        "country": "Global",
    },
    {
        "url": "https://www.iea.org/rss/news.xml",
        "source": "IEA",
        "category": "policy",
        "level": "government",
        "country": "International",
    },
    {
        "url": "https://electrek.co/feed/",
        "source": "Electrek",
        "category": "industry",
        "level": "industry_assoc",
        "country": "Global",
    },
    # ── Google News: policy & regulation ──
    {
        "url": _GN + "critical+minerals+policy+government+regulation",
        "source": "Google News",
        "category": "policy",
        "level": "government",
        "country": "Global",
    },
    {
        "url": _GN + "critical+minerals+export+controls+sanctions+legislation",
        "source": "Google News",
        "category": "policy",
        "level": "government",
        "country": "Global",
    },
    # ── Google News: Chinese policy (key signal source) ──
    {
        "url": _GN_ZH + "稀土+出口管制+关键矿产+政策",
        "source": "Google News 中文",
        "category": "policy",
        "level": "government",
        "country": "China",
    },
    # ── Google News: exploration & development ──
    {
        "url": _GN + "lithium+cobalt+%22rare+earth%22+exploration+drilling+discovery",
        "source": "Google News",
        "category": "exploration",
        "level": "industry_assoc",
        "country": "Global",
    },
    {
        "url": _GN + "critical+minerals+mine+feasibility+resource+estimate",
        "source": "Google News",
        "category": "exploration",
        "level": "industry_assoc",
        "country": "Global",
    },
    # ── Google News: corporate ──
    {
        "url": _GN + "critical+minerals+mining+acquisition+merger+investment+%22joint+venture%22",
        "source": "Google News",
        "category": "corporate",
        "level": "industry_assoc",
        "country": "Global",
    },
    # ── Google News: price & market ──
    {
        "url": _GN + "copper+lithium+cobalt+nickel+%22rare+earth%22+price+market+LME",
        "source": "Google News",
        "category": "price",
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

        is_google_news = "news.google.com" in cfg["url"]

        for entry in feed.entries[:20]:
            title = entry.get("title", "").strip()
            url = entry.get("link", "").strip()
            summary = re.sub(r"<[^>]+>", "", entry.get("summary", "")).strip()

            if not title or not url:
                continue

            # Google News embeds the publisher as " - Publisher" at the end of the title
            # and also in entry.source.title
            if is_google_news:
                source_tag = entry.get("source", {})
                real_source = (
                    source_tag.get("title")
                    or (title.rsplit(" - ", 1)[-1] if " - " in title else None)
                    or cfg["source"]
                )
                title = title.rsplit(" - ", 1)[0].strip() if " - " in title else title
            else:
                real_source = cfg["source"]

            minerals = detect_minerals(title + " " + summary)

            articles.append({
                "title": title[:500],
                "url": url[:1000],
                "source": real_source[:200],
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
