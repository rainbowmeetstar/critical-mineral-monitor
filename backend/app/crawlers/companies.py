"""
Company stock data crawler using the same Yahoo Finance v8 API as prices.py.
Fetches current stock price, % change, and approximate market cap.
"""
import logging

import httpx
from sqlalchemy import select

from ..database import AsyncSessionLocal
from ..models.company import Company, CompanySnapshot
from .base import BaseCrawler
from .prices import _YF_HEADERS

logger = logging.getLogger(__name__)


class CompanyCrawler(BaseCrawler):
    name = "companies"

    async def fetch(self) -> dict:
        updated = 0
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Company).where(Company.ticker.isnot(None))
            )
            companies = result.scalars().all()

            for company in companies:
                try:
                    price, change_pct, mkt_cap_bn = await self._fetch_stock(company.ticker)
                    if price is None:
                        continue
                    db.add(CompanySnapshot(
                        company_id=company.id,
                        stock_price=price,
                        price_change_pct=change_pct,
                        market_cap_usd_bn=mkt_cap_bn,
                    ))
                    updated += 1
                except Exception as e:
                    logger.warning(f"[{company.ticker}] failed: {e}")

            await db.commit()

        return {"success": True, "updated": updated}

    async def _fetch_stock(self, ticker: str):
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        params = {"interval": "1d", "range": "5d"}
        try:
            async with httpx.AsyncClient(
                timeout=15.0, headers=_YF_HEADERS, follow_redirects=True
            ) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            result = data["chart"]["result"][0]
            meta = result.get("meta", {})

            price = meta.get("regularMarketPrice")
            prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
            change_pct = None
            if price and prev_close:
                change_pct = ((price - prev_close) / prev_close) * 100

            # market cap in billions (Yahoo Finance quotes in local currency)
            shares = meta.get("sharesOutstanding")
            mkt_cap_bn = None
            if price and shares:
                # rough USD conversion: use price × shares; for non-USD divide by FX
                # We store as-is (local currency) and note it's approximate
                mkt_cap_bn = round(price * shares / 1e9, 2)

            return price, change_pct, mkt_cap_bn
        except Exception as e:
            logger.warning(f"Yahoo Finance error for {ticker}: {e}")
            return None, None, None
