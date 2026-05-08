"""
Price crawler using Yahoo Finance (yfinance) for traded metals and ETF proxies.
Rare earth prices sourced from USGS annual data (updated manually / yearly refresh).
"""
import logging
from datetime import datetime, timezone

import yfinance as yf
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal
from ..models.mineral import Mineral, MineralPrice
from .base import BaseCrawler

logger = logging.getLogger(__name__)

# Yahoo Finance symbols mapped to mineral names
YAHOO_PRICE_MAP = {
    "HG=F":  {"name": "Copper",    "unit": "USD/lb",      "source": "COMEX"},
    "GC=F":  {"name": "Gold",      "unit": "USD/troy oz", "source": "COMEX"},
    "SI=F":  {"name": "Silver",    "unit": "USD/troy oz", "source": "COMEX"},
    "PL=F":  {"name": "Platinum",  "unit": "USD/troy oz", "source": "NYMEX"},
    "PA=F":  {"name": "Palladium", "unit": "USD/troy oz", "source": "NYMEX"},
    "ALI=F": {"name": "Aluminum",  "unit": "USD/t",       "source": "COMEX"},
    "LIT":   {"name": "Lithium",   "unit": "USD (ETF)",   "source": "NYSE (ETF proxy: LIT)"},
    "REMX":  {"name": "Rare Earth","unit": "USD (ETF)",   "source": "NYSE (ETF proxy: REMX)"},
    "MP":    {"name": "Neodymium", "unit": "USD (equity)","source": "NYSE (MP Materials proxy)"},
}


class PriceCrawler(BaseCrawler):
    name = "prices"

    async def fetch(self) -> dict:
        updated = 0
        async with AsyncSessionLocal() as db:
            for ticker_symbol, meta in YAHOO_PRICE_MAP.items():
                try:
                    price, change_pct = await self._get_yahoo_price(ticker_symbol)
                    if price is None:
                        continue

                    mineral = await self._get_or_skip_mineral(db, meta["name"])
                    if not mineral:
                        continue

                    entry = MineralPrice(
                        mineral_id=mineral.id,
                        price=price,
                        price_change_pct=change_pct,
                        unit=meta["unit"],
                        source=meta["source"],
                        timestamp=datetime.now(timezone.utc),
                    )
                    db.add(entry)
                    updated += 1
                except Exception as e:
                    logger.warning(f"Failed to fetch {ticker_symbol}: {e}")

            await db.commit()

        return {"success": True, "updated": updated}

    async def _get_yahoo_price(self, symbol: str):
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d")
            if hist.empty:
                return None, None
            latest = hist["Close"].iloc[-1]
            if len(hist) >= 2:
                prev = hist["Close"].iloc[-2]
                change_pct = ((latest - prev) / prev) * 100 if prev else None
            else:
                change_pct = None
            return float(latest), change_pct
        except Exception as e:
            logger.warning(f"yfinance error for {symbol}: {e}")
            return None, None

    async def _get_or_skip_mineral(self, db: AsyncSession, name: str):
        result = await db.execute(select(Mineral).where(Mineral.name == name))
        return result.scalar_one_or_none()
