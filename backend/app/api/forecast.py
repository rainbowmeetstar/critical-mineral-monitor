from datetime import datetime, timedelta
from math import sqrt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database import get_db
from ..models.mineral import Mineral, MineralPrice

router = APIRouter(prefix="/minerals", tags=["forecast"])


class ForecastOut(BaseModel):
    mineral_id: int
    mineral_name: str
    signal: str            # "上行" | "下行" | "震荡" | "数据不足"
    ma7: float | None
    ma30: float | None
    slope_pct_per_day: float | None
    latest_price: float | None
    forecast_7d_low: float | None
    forecast_7d_mid: float | None
    forecast_7d_high: float | None
    data_points: int


def _linreg_slope(prices: list[float]) -> float:
    n = len(prices)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2.0
    y_mean = sum(prices) / n
    num = sum((i - x_mean) * (prices[i] - y_mean) for i in range(n))
    den = sum((i - x_mean) ** 2 for i in range(n))
    return num / den if den else 0.0


def _std_dev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return sqrt(variance)


@router.get("/{mineral_id}/forecast", response_model=ForecastOut)
async def get_forecast(mineral_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mineral).where(Mineral.id == mineral_id))
    mineral = result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(status_code=404, detail="Mineral not found")

    since = datetime.utcnow() - timedelta(days=60)
    prices_q = await db.execute(
        select(MineralPrice)
        .where(MineralPrice.mineral_id == mineral_id, MineralPrice.timestamp >= since)
        .order_by(MineralPrice.timestamp)
    )
    rows = prices_q.scalars().all()

    # Deduplicate: keep one price per calendar day (last of day)
    daily: dict[str, float] = {}
    for r in rows:
        day_key = r.timestamp.strftime("%Y-%m-%d")
        daily[day_key] = r.price
    prices = [daily[k] for k in sorted(daily.keys())]

    n = len(prices)
    base = ForecastOut(
        mineral_id=mineral_id,
        mineral_name=mineral.name,
        signal="数据不足",
        ma7=None, ma30=None,
        slope_pct_per_day=None,
        latest_price=prices[-1] if prices else None,
        forecast_7d_low=None, forecast_7d_mid=None, forecast_7d_high=None,
        data_points=n,
    )

    if n < 5:
        return base

    latest = prices[-1]
    ma7 = sum(prices[-7:]) / min(7, n)
    ma30 = sum(prices[-30:]) / min(30, n) if n >= 7 else None

    slope = _linreg_slope(prices)
    slope_pct = (slope / latest * 100) if latest else 0.0

    # Daily returns for uncertainty estimation
    daily_returns = [prices[i] - prices[i - 1] for i in range(1, n)]
    uncertainty = _std_dev(daily_returns) * sqrt(7) * 1.5

    mid = latest + slope * 7
    low = mid - uncertainty
    high = mid + uncertainty

    # Signal: require both MA cross and slope direction
    if slope_pct > 0.15 and (ma30 is None or ma7 > ma30):
        signal = "上行"
    elif slope_pct < -0.15 and (ma30 is None or ma7 < ma30):
        signal = "下行"
    else:
        signal = "震荡"

    return ForecastOut(
        mineral_id=mineral_id,
        mineral_name=mineral.name,
        signal=signal,
        ma7=round(ma7, 4),
        ma30=round(ma30, 4) if ma30 is not None else None,
        slope_pct_per_day=round(slope_pct, 4),
        latest_price=round(latest, 4),
        forecast_7d_low=round(max(low, 0), 4),
        forecast_7d_mid=round(mid, 4),
        forecast_7d_high=round(high, 4),
        data_points=n,
    )
