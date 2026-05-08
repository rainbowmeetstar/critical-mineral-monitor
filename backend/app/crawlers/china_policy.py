"""
Chinese government policy crawler.
Scrapes critical-mineral-related announcements from:
  - MIIT (Ministry of Industry and Information Technology) - 工信部
  - MNR (Ministry of Natural Resources) - 自然资源部
  - MOFCOM (Ministry of Commerce) - 商务部 (export controls)
"""
import logging
import re
from datetime import datetime

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select

from ..database import AsyncSessionLocal
from ..models.news import NewsArticle
from .base import BaseCrawler

logger = logging.getLogger(__name__)

# Keyword filter: only save articles mentioning critical minerals
CRITICAL_MINERAL_ZH = [
    "稀土", "锂", "钴", "镍", "铜", "钨", "钼", "钒", "锗", "镓",
    "铌", "铟", "铂", "钯", "关键矿产", "战略矿产", "矿产资源",
    "新能源", "动力电池", "出口管制", "出口许可",
]

SOURCES = [
    {
        "name": "工信部",
        "url": "https://www.miit.gov.cn/jgsj/ycls/wjfb/index.html",
        "base": "https://www.miit.gov.cn",
        "country": "China",
        "selectors": {
            "items": "ul.zxxx_list li, div.list_item li",
            "title": "a",
            "date": "span",
        },
    },
    {
        "name": "自然资源部",
        "url": "https://www.mnr.gov.cn/dt/ywbb/",
        "base": "https://www.mnr.gov.cn",
        "country": "China",
        "selectors": {
            "items": "ul.news_list li, div.news_list li",
            "title": "a",
            "date": "span.time, span.date",
        },
    },
    {
        "name": "商务部",
        "url": "http://www.mofcom.gov.cn/article/zwgk/zcfb/",
        "base": "http://www.mofcom.gov.cn",
        "country": "China",
        "selectors": {
            "items": "ul li",
            "title": "a",
            "date": "span",
        },
    },
]

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _is_relevant(title: str) -> bool:
    return any(kw in title for kw in CRITICAL_MINERAL_ZH)


def _parse_cn_date(text: str) -> datetime | None:
    text = text.strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y年%m月%d日", "%Y.%m.%d"):
        try:
            return datetime.strptime(text[:10], fmt[:len(fmt)])
        except ValueError:
            continue
    m = re.search(r"(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})", text)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    return None


class ChinaPolicyCrawler(BaseCrawler):
    name = "china_policy"

    async def fetch(self) -> dict:
        saved = 0
        async with AsyncSessionLocal() as db:
            for src in SOURCES:
                try:
                    articles = await self._scrape_source(src)
                    for data in articles:
                        existing = await db.execute(
                            select(NewsArticle).where(NewsArticle.url == data["url"])
                        )
                        if existing.scalar_one_or_none():
                            continue
                        db.add(NewsArticle(**data))
                        saved += 1
                    await db.commit()
                except Exception as e:
                    logger.warning(f"[{src['name']}] crawl error: {e}")
        return {"success": True, "saved": saved}

    async def _scrape_source(self, src: dict) -> list[dict]:
        try:
            async with httpx.AsyncClient(
                timeout=20.0, headers=_HEADERS, follow_redirects=True
            ) as client:
                resp = await client.get(src["url"])
                resp.raise_for_status()
                html = resp.text
        except Exception as e:
            logger.warning(f"[{src['name']}] HTTP error: {e}")
            return []

        soup = BeautifulSoup(html, "lxml")
        sel = src["selectors"]
        results = []

        for item in soup.select(sel["items"])[:30]:
            title_el = item.select_one(sel["title"])
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or not _is_relevant(title):
                continue

            href = title_el.get("href", "")
            if not href:
                continue
            url = href if href.startswith("http") else src["base"] + href

            date_el = item.select_one(sel["date"])
            published_at = _parse_cn_date(date_el.get_text() if date_el else "") or datetime.utcnow()

            results.append({
                "title": title[:500],
                "url": url[:1000],
                "source": src["name"],
                "category": "policy",
                "level": "government",
                "country": src["country"],
                "published_at": published_at,
                "summary": None,
                "minerals_mentioned": [],
            })

        return results
