"""
Price forecast: technical analysis + news sentiment → composite score + Chinese outlook text.
All computation is local — no external AI API required.
"""
from datetime import datetime, timedelta
from math import sqrt, log

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_, Text
from sqlalchemy import cast as sa_cast
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database import get_db
from ..models.mineral import Mineral, MineralPrice
from ..models.news import NewsArticle

router = APIRouter(prefix="/minerals", tags=["forecast"])


# ── Response schema ────────────────────────────────────────────────────────────

class SignalItem(BaseModel):
    label: str
    value: str
    score: float          # contribution to composite, negative = bearish
    direction: str        # "bull" | "bear" | "neutral"


class ForecastOut(BaseModel):
    mineral_id: int
    mineral_name: str
    data_points: int

    # Technical
    latest_price: float | None
    ma7: float | None
    ma30: float | None
    ma90: float | None
    rsi14: float | None
    momentum_7d_pct: float | None
    momentum_30d_pct: float | None
    volatility_30d_pct: float | None
    slope_pct_per_day: float | None

    # Forecast range
    forecast_7d_low: float | None
    forecast_7d_mid: float | None
    forecast_7d_high: float | None

    # News sentiment
    news_7d_total: int
    news_30d_policy: int
    news_30d_price: int
    news_30d_exploration: int

    # Composite
    composite_score: float          # –3 … +3
    outlook: str                    # 看涨 / 温和看涨 / 中性 / 温和看跌 / 看跌
    signal_breakdown: list[SignalItem]
    outlook_text: str               # Chinese natural-language paragraph


# ── Pure-Python statistics ─────────────────────────────────────────────────────

def _ema(prices: list[float], period: int) -> float:
    if not prices:
        return 0.0
    k = 2 / (period + 1)
    val = prices[0]
    for p in prices[1:]:
        val = p * k + val * (1 - k)
    return val


def _linreg_slope(prices: list[float]) -> float:
    n = len(prices)
    if n < 2:
        return 0.0
    xm = (n - 1) / 2
    ym = sum(prices) / n
    num = sum((i - xm) * (prices[i] - ym) for i in range(n))
    den = sum((i - xm) ** 2 for i in range(n))
    return num / den if den else 0.0


def _rsi(prices: list[float], period: int = 14) -> float | None:
    if len(prices) < period + 1:
        return None
    changes = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
    gains = [max(c, 0) for c in changes[-period:]]
    losses = [max(-c, 0) for c in changes[-period:]]
    ag = sum(gains) / period
    al = sum(losses) / period
    if al == 0:
        return 100.0
    rs = ag / al
    return 100 - (100 / (1 + rs))


def _volatility_pct(prices: list[float]) -> float | None:
    if len(prices) < 2:
        return None
    returns = [log(prices[i] / prices[i - 1]) for i in range(1, len(prices)) if prices[i - 1] > 0]
    if len(returns) < 2:
        return None
    mean = sum(returns) / len(returns)
    var = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
    return sqrt(var) * sqrt(252) * 100   # annualised %


def _std_dev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return sqrt(sum((v - mean) ** 2 for v in values) / (len(values) - 1))


# ── Signal scoring ─────────────────────────────────────────────────────────────

def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _score_signals(
    prices: list[float],
    ma7: float | None, ma30: float | None, ma90: float | None,
    rsi: float | None,
    mom_7d: float | None, mom_30d: float | None,
    vol_30d: float | None,
    slope_pct: float | None,
    news_policy: int, news_price: int, news_exploration: int,
) -> tuple[float, list[SignalItem]]:
    items: list[SignalItem] = []

    def add(label: str, value: str, score: float):
        direction = "bull" if score > 0.1 else "bear" if score < -0.1 else "neutral"
        items.append(SignalItem(label=label, value=value, score=round(score, 2), direction=direction))

    total = 0.0

    # ① 均线排列 (MA cross)
    if ma7 and ma30:
        ratio = (ma7 - ma30) / ma30 * 100
        s = _clamp(ratio / 3, -1, 1)
        cross = "金叉" if ratio > 1 else "死叉" if ratio < -1 else "粘合"
        add("均线排列", f"MA7/MA30 {cross}（{ratio:+.1f}%）", s)
        total += s

    # ② RSI
    if rsi is not None:
        if rsi > 75:
            s, label = -0.8, f"{rsi:.0f} 超买"
        elif rsi > 60:
            s, label = -0.3, f"{rsi:.0f} 偏高"
        elif rsi < 25:
            s, label = +0.8, f"{rsi:.0f} 超卖"
        elif rsi < 40:
            s, label = +0.3, f"{rsi:.0f} 偏低"
        else:
            s, label = 0.0, f"{rsi:.0f} 中性"
        add("RSI(14)", label, s)
        total += s

    # ③ 30日动量
    if mom_30d is not None:
        s = _clamp(mom_30d / 15, -1, 1)
        add("30日动量", f"{mom_30d:+.1f}%", s)
        total += s

    # ④ 7日动量
    if mom_7d is not None:
        s = _clamp(mom_7d / 8, -0.5, 0.5)
        add("7日动量", f"{mom_7d:+.1f}%", s)
        total += s

    # ⑤ 趋势斜率
    if slope_pct is not None:
        s = _clamp(slope_pct * 20, -0.5, 0.5)
        add("价格趋势", f"{slope_pct:+.3f}%/天", s)
        total += s

    # ⑥ 波动率 — high vol = uncertainty (slight negative)
    if vol_30d is not None:
        if vol_30d > 60:
            s, label = -0.3, f"{vol_30d:.0f}% 高波动"
        elif vol_30d < 20:
            s, label = +0.1, f"{vol_30d:.0f}% 低波动"
        else:
            s, label = 0.0, f"{vol_30d:.0f}% 正常"
        add("年化波动率", label, s)
        total += s

    # ⑦ 新闻情感面
    news_signal = 0.0
    news_parts = []
    if news_policy > 0:
        news_signal += min(news_policy * 0.1, 0.3)
        news_parts.append(f"政策{news_policy}篇")
    if news_price > 0:
        news_signal += min(news_price * 0.05, 0.2)
        news_parts.append(f"价格{news_price}篇")
    if news_exploration > 0:
        news_signal += min(news_exploration * 0.05, 0.15)
        news_parts.append(f"勘探{news_exploration}篇")
    if news_parts:
        add("近30日资讯", "、".join(news_parts), round(news_signal, 2))
        total += news_signal

    return round(total, 2), items


def _outlook_label(score: float) -> str:
    if score >= 1.8:   return "看涨"
    if score >= 0.6:   return "温和看涨"
    if score <= -1.8:  return "看跌"
    if score <= -0.6:  return "温和看跌"
    return "中性"


# ── Natural-language generation ────────────────────────────────────────────────

def _build_outlook_text(
    name_zh: str | None, name: str,
    outlook: str, composite: float,
    ma7: float | None, ma30: float | None, ma90: float | None,
    rsi: float | None,
    mom_7d: float | None, mom_30d: float | None,
    vol_30d: float | None,
    news_7d: int, news_policy: int, news_price: int, news_exploration: int,
    forecast_low: float | None, forecast_high: float | None,
    data_points: int,
) -> str:
    display = name_zh or name
    sentences: list[str] = []

    # ① 价格动态
    if mom_30d is not None:
        if mom_30d > 10:
            sentences.append(f"{display}近30日累计上涨{mom_30d:.1f}%，中期上行动能较强")
        elif mom_30d > 3:
            sentences.append(f"{display}近30日温和上涨{mom_30d:.1f}%，中期趋势偏多")
        elif mom_30d < -10:
            sentences.append(f"{display}近30日累计下跌{abs(mom_30d):.1f}%，中期承压明显")
        elif mom_30d < -3:
            sentences.append(f"{display}近30日小幅下跌{abs(mom_30d):.1f}%，中期趋势偏弱")
        else:
            sentences.append(f"{display}近30日价格基本持平（{mom_30d:+.1f}%），处于横盘震荡区间")
    elif data_points >= 5:
        sentences.append(f"{display}历史价格数据共{data_points}个交易日")

    # ② 均线信号
    if ma7 and ma30:
        spread = (ma7 - ma30) / ma30 * 100
        if spread > 2:
            sentences.append(f"短期均线（MA7={ma7:.2f}）明显位于中期均线（MA30={ma30:.2f}）上方，多头排列形态成立")
        elif spread > 0.5:
            sentences.append(f"短期均线（MA7）小幅高于中期均线（MA30），均线初步金叉，方向偏多")
        elif spread < -2:
            sentences.append(f"短期均线（MA7={ma7:.2f}）跌破中期均线（MA30={ma30:.2f}），空头排列压制反弹")
        elif spread < -0.5:
            sentences.append(f"短期均线已死叉中期均线，短期压力犹存")
        else:
            sentences.append(f"短期均线与中期均线高度接近（差{spread:+.1f}%），多空分歧，等待方向选择")

    # ③ RSI
    if rsi is not None:
        if rsi > 75:
            sentences.append(f"RSI达{rsi:.0f}，技术面已进入超买区，短期回调风险不可忽视")
        elif rsi > 60:
            sentences.append(f"RSI为{rsi:.0f}，技术面偏高但未超买，强势行情仍可延续")
        elif rsi < 25:
            sentences.append(f"RSI降至{rsi:.0f}，深度超卖，存在技术性反弹动能")
        elif rsi < 40:
            sentences.append(f"RSI为{rsi:.0f}，技术面偏弱，尚未触发超卖反弹信号")
        # 40-60 不描述 RSI，避免废话

    # ④ 波动率
    if vol_30d is not None and vol_30d > 50:
        sentences.append(f"近期年化波动率达{vol_30d:.0f}%，价格波动较为剧烈，需控制持仓风险")

    # ⑤ 新闻面
    news_items = []
    if news_policy > 0:
        news_items.append(f"政策类资讯{news_policy}篇")
    if news_price > 0:
        news_items.append(f"价格类资讯{news_price}篇")
    if news_exploration > 0:
        news_items.append(f"勘探类资讯{news_exploration}篇")
    if news_7d > 3:
        sentences.append(f"近7日{display}相关资讯活跃（共{news_7d}篇），市场关注度提升")
    if news_items:
        sentences.append(f"近30日资讯覆盖：{'、'.join(news_items)}，政策与市场动态持续更新")

    # ⑥ 预测区间
    if forecast_low is not None and forecast_high is not None:
        sentences.append(f"基于当前趋势外推，未来7日价格预测区间约为 {forecast_low:.2f}–{forecast_high:.2f}")

    # ⑦ 综合结论
    conclusion_map = {
        "看涨":   f"综合技术与资讯信号，{display}短期多头信号占优，建议关注量能配合情况。",
        "温和看涨": f"综合信号偏多，{display}短期有望维持温和上行，但需警惕外部扰动风险。",
        "中性":   f"当前多空信号相对均衡，{display}暂无明确方向，建议观望并等待突破。",
        "温和看跌": f"综合信号偏弱，{display}短期价格承压，下行空间需结合基本面进一步判断。",
        "看跌":   f"多项指标显示空头占优，{display}短期压力较大，建议密切关注关键支撑位。",
    }
    sentences.append(conclusion_map.get(outlook, ""))
    sentences.append("⚠ 以上分析仅供参考，不构成投资建议。")

    return " ".join(s for s in sentences if s)


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.get("/{mineral_id}/forecast", response_model=ForecastOut)
async def get_forecast(mineral_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mineral).where(Mineral.id == mineral_id))
    mineral = result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(status_code=404, detail="Mineral not found")

    # ── Price data ──────────────────────────────────────────────────────────────
    since = datetime.utcnow() - timedelta(days=365)
    prices_q = await db.execute(
        select(MineralPrice)
        .where(MineralPrice.mineral_id == mineral_id, MineralPrice.timestamp >= since)
        .order_by(MineralPrice.timestamp)
    )
    rows = prices_q.scalars().all()

    # Deduplicate by calendar day
    daily: dict[str, float] = {}
    for r in rows:
        daily[r.timestamp.strftime("%Y-%m-%d")] = r.price
    prices = [daily[k] for k in sorted(daily.keys())]
    n = len(prices)

    empty = ForecastOut(
        mineral_id=mineral_id, mineral_name=mineral.name,
        data_points=n, latest_price=prices[-1] if prices else None,
        ma7=None, ma30=None, ma90=None, rsi14=None,
        momentum_7d_pct=None, momentum_30d_pct=None,
        volatility_30d_pct=None, slope_pct_per_day=None,
        forecast_7d_low=None, forecast_7d_mid=None, forecast_7d_high=None,
        news_7d_total=0, news_30d_policy=0, news_30d_price=0, news_30d_exploration=0,
        composite_score=0.0, outlook="数据不足",
        signal_breakdown=[],
        outlook_text="历史价格数据不足，无法生成分析。系统正在后台补充数据，稍后刷新重试。",
    )
    if n < 5:
        return empty

    latest = prices[-1]

    # ── Technical indicators ────────────────────────────────────────────────────
    ma7  = sum(prices[-7:])  / min(7, n)
    ma30 = sum(prices[-30:]) / min(30, n) if n >= 7  else None
    ma90 = sum(prices[-90:]) / min(90, n) if n >= 30 else None

    slope = _linreg_slope(prices[-60:] if n > 60 else prices)
    slope_pct = (slope / latest * 100) if latest else 0.0

    rsi = _rsi(prices)

    mom_7d  = ((prices[-1] - prices[-min(8, n)])  / prices[-min(8, n)]  * 100) if n >= 2 else None
    mom_30d = ((prices[-1] - prices[-min(31, n)]) / prices[-min(31, n)] * 100) if n >= 2 else None

    vol_30d = _volatility_pct(prices[-30:]) if n >= 10 else None

    daily_changes = [prices[i] - prices[i - 1] for i in range(1, n)]
    uncertainty = _std_dev(daily_changes[-30:]) * sqrt(7) * 1.5
    f_mid  = latest + slope * 7
    f_low  = max(f_mid - uncertainty, 0)
    f_high = f_mid + uncertainty

    # ── News sentiment ──────────────────────────────────────────────────────────
    since_7d  = datetime.utcnow() - timedelta(days=7)
    since_30d = datetime.utcnow() - timedelta(days=30)
    search_names = [nm for nm in [mineral.name, mineral.name_zh] if nm]

    def _news_q(since_dt, category=None):
        q = select(func.count()).select_from(NewsArticle)
        q = q.where(NewsArticle.published_at >= since_dt)
        if category:
            q = q.where(NewsArticle.category == category)
        if search_names:
            q = q.where(or_(*[
                sa_cast(NewsArticle.minerals_mentioned, Text).ilike(f"%{nm}%")  # type: ignore[arg-type]
                for nm in search_names
            ]))
        return q

    news_7d_total   = (await db.execute(_news_q(since_7d))).scalar() or 0
    news_30d_policy = (await db.execute(_news_q(since_30d, "policy"))).scalar() or 0
    news_30d_price  = (await db.execute(_news_q(since_30d, "price"))).scalar() or 0
    news_30d_expl   = (await db.execute(_news_q(since_30d, "exploration"))).scalar() or 0

    # ── Composite score & signals ───────────────────────────────────────────────
    composite, breakdown = _score_signals(
        prices, ma7, ma30, ma90, rsi,
        mom_7d, mom_30d, vol_30d, slope_pct,
        news_30d_policy, news_30d_price, news_30d_expl,
    )
    outlook = _outlook_label(composite)

    outlook_text = _build_outlook_text(
        mineral.name_zh, mineral.name,
        outlook, composite,
        ma7, ma30, ma90, rsi,
        mom_7d, mom_30d, vol_30d,
        news_7d_total, news_30d_policy, news_30d_price, news_30d_expl,
        f_low, f_high, n,
    )

    def r4(v): return round(v, 4) if v is not None else None

    return ForecastOut(
        mineral_id=mineral_id,
        mineral_name=mineral.name,
        data_points=n,
        latest_price=r4(latest),
        ma7=r4(ma7), ma30=r4(ma30), ma90=r4(ma90),
        rsi14=r4(rsi),
        momentum_7d_pct=r4(mom_7d),
        momentum_30d_pct=r4(mom_30d),
        volatility_30d_pct=r4(vol_30d),
        slope_pct_per_day=r4(slope_pct),
        forecast_7d_low=r4(max(f_low, 0)),
        forecast_7d_mid=r4(f_mid),
        forecast_7d_high=r4(f_high),
        news_7d_total=news_7d_total,
        news_30d_policy=news_30d_policy,
        news_30d_price=news_30d_price,
        news_30d_exploration=news_30d_expl,
        composite_score=composite,
        outlook=outlook,
        signal_breakdown=breakdown,
        outlook_text=outlook_text,
    )
