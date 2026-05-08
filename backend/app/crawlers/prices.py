"""
Price crawler using Yahoo Finance chart API for traded metals and ETF proxies.
Uses direct httpx calls instead of the yfinance library for cloud reliability.
"""
import logging
from datetime import datetime, timezone, date

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal
from ..models.mineral import Mineral, MineralPrice
from ..models.alert import PriceAlert, AlertTrigger
from .base import BaseCrawler

logger = logging.getLogger(__name__)

YAHOO_PRICE_MAP = {
    "HG=F":  {"name": "Copper",    "unit": "USD/lb",      "source": "COMEX"},
    "GC=F":  {"name": "Gold",      "unit": "USD/troy oz", "source": "COMEX"},
    "SI=F":  {"name": "Silver",    "unit": "USD/troy oz", "source": "COMEX"},
    "PL=F":  {"name": "Platinum",  "unit": "USD/troy oz", "source": "NYMEX"},
    "PA=F":  {"name": "Palladium", "unit": "USD/troy oz", "source": "NYMEX"},
    "ALI=F": {"name": "Aluminum",  "unit": "USD/t",       "source": "COMEX"},
    "LIT":   {"name": "Lithium",   "unit": "USD (ETF)",   "source": "NYSE (ETF proxy: LIT)"},
    "MP":    {"name": "Neodymium", "unit": "USD (equity)","source": "NYSE (MP Materials proxy)"},
}

_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}


async def backfill_price_history():
    """Fetch 1 year of daily history for all tickers and insert missing data points."""
    logger.info("Starting price history backfill...")
    inserted_total = 0
    async with AsyncSessionLocal() as db:
        for ticker_symbol, meta in YAHOO_PRICE_MAP.items():
            try:
                mineral = await _get_mineral(db, meta["name"])
                if not mineral:
                    continue

                history = await _fetch_yahoo_history(ticker_symbol, range_="1y")
                if not history:
                    continue

                # Find existing dates to avoid duplicates
                existing_q = await db.execute(
                    select(func.date(MineralPrice.timestamp)).where(
                        MineralPrice.mineral_id == mineral.id
                    )
                )
                existing_dates: set[str] = {str(r[0]) for r in existing_q.all()}

                inserted = 0
                for ts, price, change_pct in history:
                    day_str = ts.strftime("%Y-%m-%d")
                    if day_str in existing_dates:
                        continue
                    db.add(MineralPrice(
                        mineral_id=mineral.id,
                        price=price,
                        price_change_pct=change_pct,
                        unit=meta["unit"],
                        source=meta["source"],
                        timestamp=ts,
                    ))
                    existing_dates.add(day_str)
                    inserted += 1

                if inserted:
                    logger.info(f"Backfilled {inserted} days for {meta['name']} ({ticker_symbol})")
                    inserted_total += inserted

            except Exception as e:
                logger.warning(f"Backfill failed for {ticker_symbol}: {e}")

        await db.commit()
    logger.info(f"Price history backfill complete: {inserted_total} new records")


async def _fetch_yahoo_history(symbol: str, range_: str = "1y") -> list[tuple[datetime, float, float | None]]:
    """Return list of (timestamp, close_price, change_pct) for each trading day."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"interval": "1d", "range": range_}
    try:
        async with httpx.AsyncClient(
            timeout=20.0, headers=_YF_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        result = data["chart"]["result"][0]
        timestamps = result.get("timestamp", [])
        closes = result["indicators"]["quote"][0].get("close", [])

        points = []
        prev = None
        for ts_epoch, close in zip(timestamps, closes):
            if close is None:
                prev = close
                continue
            close = float(close)
            change_pct = ((close - prev) / prev * 100) if prev else None
            dt = datetime.fromtimestamp(ts_epoch, tz=timezone.utc).replace(tzinfo=None)
            points.append((dt, close, change_pct))
            prev = close
        return points
    except Exception as e:
        logger.warning(f"Yahoo history fetch error for {symbol}: {e}")
        return []


async def _get_mineral(db: AsyncSession, name: str):
    result = await db.execute(select(Mineral).where(Mineral.name == name))
    return result.scalar_one_or_none()


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

                    mineral = await _get_mineral(db, meta["name"])
                    if not mineral:
                        logger.warning(f"No mineral found for name='{meta['name']}'")
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
            await self._check_alerts(db)

        return {"success": True, "updated": updated}

    async def _check_alerts(self, db):
        from sqlalchemy import desc
        alerts_q = await db.execute(
            select(PriceAlert).where(PriceAlert.active == True)  # noqa: E712
        )
        alerts = alerts_q.scalars().all()
        for alert in alerts:
            price_q = await db.execute(
                select(MineralPrice)
                .where(MineralPrice.mineral_id == alert.mineral_id)
                .order_by(desc(MineralPrice.timestamp))
                .limit(1)
            )
            latest = price_q.scalar_one_or_none()
            if not latest:
                continue
            triggered = (
                (alert.direction == "above" and latest.price > alert.threshold) or
                (alert.direction == "below" and latest.price < alert.threshold)
            )
            if triggered:
                db.add(AlertTrigger(
                    alert_id=alert.id,
                    price_at_trigger=latest.price,
                ))
                logger.info(
                    f"Alert {alert.id} triggered: {alert.direction} {alert.threshold}, "
                    f"current={latest.price}"
                )
        await db.commit()

    async def _get_yahoo_price(self, symbol: str):
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        params = {"interval": "1d", "range": "5d"}
        try:
            async with httpx.AsyncClient(
                timeout=15.0, headers=_YF_HEADERS, follow_redirects=True
            ) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            result = data["chart"]["result"][0]
            closes = result["indicators"]["quote"][0].get("close", [])
            closes = [c for c in closes if c is not None]

            if not closes:
                return None, None

            latest = float(closes[-1])
            change_pct = None
            if len(closes) >= 2:
                prev = closes[-2]
                if prev:
                    change_pct = ((latest - prev) / prev) * 100

            return latest, change_pct
        except Exception as e:
            logger.warning(f"Yahoo Finance API error for {symbol}: {e}")
            return None, None

