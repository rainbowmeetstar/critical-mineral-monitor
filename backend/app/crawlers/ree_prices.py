"""
Rare earth spot price crawler scraping 生意社 (100ppi.com) public price board.
No login required; prices are publicly listed in CNY/t.
"""
import logging
import re
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select

from ..database import AsyncSessionLocal
from ..models.mineral import Mineral, MineralPrice
from .base import BaseCrawler

logger = logging.getLogger(__name__)

# 生意社 rare-earth category page (公开，无需登录)
_100PPI_REE_URL = "https://www.100ppi.com/price/index-73.html"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.100ppi.com/",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

# Map Chinese commodity names on 100ppi to our Mineral.name
# Key = substring to match in 生意社 product name, Value = Mineral.name in DB
NAME_MAP: dict[str, str] = {
    "氧化钕":    "Neodymium",
    "钕铁硼":    "Neodymium",
    "氧化镨":    "Praseodymium",
    "镨钕":      "Praseodymium",
    "氧化镝":    "Dysprosium",
    "镝铁":      "Dysprosium",
    "氧化铽":    "Terbium",
    "氧化镧":    "Lanthanum",
    "氧化铈":    "Cerium",
    "氧化钆":    "Gadolinium",
    "氧化钇":    "Yttrium",
    "氧化钪":    "Scandium",
    "氧化铕":    "Europium",
    "碳酸锂":    "Lithium",
    "氢氧化锂":  "Lithium",
    "钴":        "Cobalt",
    "电解镍":    "Nickel",
}


def _parse_price(text: str) -> float | None:
    text = text.replace(",", "").strip()
    m = re.search(r"[\d.]+", text)
    return float(m.group()) if m else None


class ReeSpotPriceCrawler(BaseCrawler):
    name = "ree_spot"

    async def fetch(self) -> dict:
        rows = await self._scrape_100ppi()
        if not rows:
            return {"success": False, "updated": 0, "error": "no data scraped"}

        updated = 0
        async with AsyncSessionLocal() as db:
            for name_cn, price_val, unit in rows:
                mineral_name = self._resolve_mineral(name_cn)
                if not mineral_name:
                    continue
                result = await db.execute(
                    select(Mineral).where(Mineral.name == mineral_name)
                )
                mineral = result.scalar_one_or_none()
                if not mineral:
                    continue
                db.add(MineralPrice(
                    mineral_id=mineral.id,
                    price=price_val,
                    price_change_pct=None,
                    unit=unit,
                    source="生意社(100ppi.com)",
                    timestamp=datetime.now(timezone.utc),
                ))
                updated += 1
            await db.commit()

        return {"success": True, "updated": updated}

    async def _scrape_100ppi(self) -> list[tuple[str, float, str]]:
        try:
            async with httpx.AsyncClient(
                timeout=20.0, headers=_HEADERS, follow_redirects=True
            ) as client:
                resp = await client.get(_100PPI_REE_URL)
                resp.raise_for_status()
                html = resp.text
        except Exception as e:
            logger.warning(f"100ppi fetch error: {e}")
            return []

        soup = BeautifulSoup(html, "lxml")
        results: list[tuple[str, float, str]] = []

        # 生意社价格表结构: <table> with rows containing product name, price, unit
        for row in soup.select("table tr"):
            cols = row.find_all("td")
            if len(cols) < 3:
                continue
            name_text = cols[0].get_text(strip=True)
            price_text = cols[1].get_text(strip=True) or cols[2].get_text(strip=True)
            unit_el = row.select_one("td:nth-child(3), td:nth-child(4)")
            unit = unit_el.get_text(strip=True) if unit_el else "CNY/t"
            if not unit or unit.isdigit():
                unit = "CNY/t"

            price = _parse_price(price_text)
            if price and price > 0 and name_text:
                results.append((name_text, price, unit))

        logger.info(f"100ppi scraped {len(results)} rows")
        return results

    def _resolve_mineral(self, name_cn: str) -> str | None:
        for keyword, mineral_name in NAME_MAP.items():
            if keyword in name_cn:
                return mineral_name
        return None
