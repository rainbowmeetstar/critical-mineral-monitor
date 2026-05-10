from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from ..database import get_db
from ..models.mineral import Mineral, MineralPrice
from ..models.news import NewsArticle
from ..models.company import Company
from ..models.alert import AlertTrigger, PriceAlert

router = APIRouter(prefix="/map", tags=["map"])

COUNTRY_COORDS: dict[str, tuple[float, float]] = {
    "China": (35.86, 104.19), "Australia": (-25.27, 133.77),
    "United States": (37.09, -95.71), "Chile": (-35.67, -71.54),
    "DRC": (-4.04, 21.76), "Myanmar": (19.16, 96.66),
    "South Africa": (-30.56, 22.94), "Russia": (61.52, 105.32),
    "Indonesia": (-0.79, 113.92), "Philippines": (12.88, 121.77),
    "Canada": (56.13, -106.35), "Brazil": (-14.24, -51.93),
    "Peru": (-9.19, -75.02), "Bolivia": (-16.29, -63.59),
    "Mexico": (23.63, -102.55), "India": (20.59, 78.96),
    "Kazakhstan": (48.02, 66.92), "Vietnam": (14.06, 108.28),
    "Zimbabwe": (-19.02, 29.15), "Madagascar": (-18.77, 46.87),
    "Mozambique": (-18.67, 35.53), "Tanzania": (-6.37, 34.89),
    "South Korea": (35.91, 127.77), "Japan": (36.20, 138.25),
    "Gabon": (-0.80, 11.61), "Ukraine": (48.38, 31.17),
    "UAE": (23.42, 53.85), "Argentina": (-38.42, -63.62),
    "Norway": (60.47, 8.47), "Sweden": (60.13, 18.64),
    "Germany": (51.16, 10.45), "UK": (55.37, -3.44),
}

# Geopolitical risk baseline (0-100)
GEO_RISK: dict[str, int] = {
    "Ukraine": 92, "DRC": 85, "Myanmar": 82, "Russia": 78,
    "Zimbabwe": 65, "Mozambique": 60, "Kazakhstan": 55, "Bolivia": 52,
    "Philippines": 50, "Indonesia": 45, "Vietnam": 42, "Madagascar": 48,
    "Tanzania": 45, "Gabon": 42, "India": 38, "Peru": 38,
    "Mexico": 40, "China": 58, "South Africa": 38, "Brazil": 32,
    "Argentina": 35, "Chile": 25, "Canada": 10, "Australia": 12,
    "United States": 20, "Japan": 12, "South Korea": 20,
    "Norway": 8, "Sweden": 8, "Germany": 15, "UK": 15,
}

KNOWN_MINES: dict[str, list] = {
    "Australia": [
        {"name": "Greenbushes 锂矿", "location": "西澳州", "mineral": "锂", "output": "48 万吨/年"},
        {"name": "Pilbara Minerals 锂矿区", "location": "西澳州", "mineral": "铁·镍", "output": "—"},
        {"name": "Mount Weld 稀土矿", "location": "西澳州", "mineral": "稀土", "output": "2.2 万吨/年"},
        {"name": "Olympic Dam 铜金矿", "location": "南澳州", "mineral": "铜·金", "output": "23 万吨/年"},
    ],
    "China": [
        {"name": "包头稀土矿区", "location": "内蒙古", "mineral": "稀土", "output": "全球第一"},
        {"name": "赣南稀土矿区", "location": "江西", "mineral": "重稀土", "output": "主产区"},
        {"name": "四川锂矿区", "location": "四川/青海", "mineral": "锂", "output": "—"},
        {"name": "金川镍矿", "location": "甘肃", "mineral": "镍·铂族", "output": "重要产地"},
    ],
    "DRC": [
        {"name": "Tenke Fungurume", "location": "加丹加省", "mineral": "钴·铜", "output": "全球最大钴矿"},
        {"name": "Kamoa-Kakula 铜矿", "location": "刚果中部", "mineral": "铜", "output": "高品位铜矿"},
        {"name": "RTR 钴矿区", "location": "加丹加", "mineral": "钴", "output": "—"},
    ],
    "Chile": [
        {"name": "Atacama 盐湖", "location": "阿塔卡马沙漠", "mineral": "锂", "output": "全球最大锂盐湖"},
        {"name": "Escondida 铜矿", "location": "安托法加斯塔", "mineral": "铜", "output": "全球最大铜矿"},
        {"name": "Codelco 铜矿群", "location": "北部高原", "mineral": "铜", "output": "国家级"},
    ],
    "Russia": [
        {"name": "Norilsk 镍钯矿", "location": "诺里尔斯克", "mineral": "镍·钯·铂", "output": "全球最大钯矿"},
        {"name": "Kovdor 矿区", "location": "科拉半岛", "mineral": "磷灰石·铁", "output": "重要产地"},
    ],
    "South Africa": [
        {"name": "Bushveld 杂岩体", "location": "豪登省", "mineral": "铂·钯·铑", "output": "全球80% PGM"},
        {"name": "Impala 铂矿", "location": "西北省", "mineral": "铂族", "output": "主要生产商"},
    ],
    "Indonesia": [
        {"name": "Morowali 工业园", "location": "中苏拉威西", "mineral": "镍", "output": "全球最大镍产区"},
        {"name": "Weda Bay 镍矿", "location": "哈马黑拉岛", "mineral": "镍·钴", "output": "—"},
    ],
    "Canada": [
        {"name": "Thompson 镍矿", "location": "马尼托巴", "mineral": "镍", "output": "重要产地"},
        {"name": "Sudbury 矿区", "location": "安大略", "mineral": "镍·铜·铂族", "output": "历史矿区"},
        {"name": "Ring of Fire 项目", "location": "安大略北部", "mineral": "铬·镍", "output": "开发中"},
    ],
    "Kazakhstan": [
        {"name": "Zhezkazgan 铜矿", "location": "卡拉干达州", "mineral": "铜", "output": "重要产地"},
        {"name": "Khromtau 铬矿", "location": "阿克托别州", "mineral": "铬", "output": "全球主产区"},
    ],
    "United States": [
        {"name": "Mountain Pass 稀土矿", "location": "加利福尼亚", "mineral": "稀土", "output": "西半球最大"},
        {"name": "Stillwater 钯矿", "location": "蒙大拿", "mineral": "钯·铂", "output": "北美唯一"},
    ],
    "Brazil": [
        {"name": "Serra Verde 稀土矿", "location": "戈亚斯州", "mineral": "稀土", "output": "开发中"},
        {"name": "Araxá 铌矿", "location": "米纳斯吉拉斯", "mineral": "铌", "output": "全球最大铌矿"},
    ],
    "Myanmar": [
        {"name": "克钦邦稀土矿区", "location": "北部克钦邦", "mineral": "重稀土", "output": "全球第二"},
        {"name": "掸邦锡钨矿", "location": "掸邦", "mineral": "锡·钨", "output": "重要产区"},
    ],
}


def _norm(raw: str) -> str:
    return raw.split("(")[0].strip()


def _compute_risk(country: str, minerals: list, news: list, triggered_ids: set) -> dict:
    geo = GEO_RISK.get(country, 30)

    crit_sum = sum(m.get("criticality_score") or 0 for m in minerals)
    supply = min(100, int(crit_sum * 2.5))

    volatile = sum(1 for m in minerals
                   if m.get("latest_price") and abs(m["latest_price"].get("price_change_pct") or 0) > 2)
    price = min(100, volatile * 20 + (30 if any(m["id"] in triggered_ids for m in minerals) else 0))

    policy_n = sum(1 for n in news if n.get("category") == "policy")
    corp_n   = sum(1 for n in news if n.get("category") == "corporate")
    expl_n   = sum(1 for n in news if n.get("category") == "exploration")

    industry    = min(100, corp_n * 12 + 10)
    environmental = min(100, expl_n * 15 + 15)

    geopolitical = min(100, geo + policy_n * 5)

    risk_score = int(supply * 0.30 + price * 0.20 + geopolitical * 0.25 + industry * 0.15 + environmental * 0.10)
    if risk_score >= 70:
        level = "critical"
    elif risk_score >= 50:
        level = "high"
    elif risk_score >= 30:
        level = "medium"
    else:
        level = "low"

    return {
        "supply": supply, "price": price, "geopolitical": geopolitical,
        "industry": industry, "environmental": environmental,
        "risk_score": risk_score, "risk_level": level,
    }


@router.get("")
async def get_producer_map(db: AsyncSession = Depends(get_db)):
    minerals_r = await db.execute(select(Mineral))
    minerals = minerals_r.scalars().all()

    country_map: dict[str, dict] = {}
    for m in minerals:
        for raw in (m.top_producers or []):
            c = _norm(raw)
            if c not in COUNTRY_COORDS:
                continue
            if c not in country_map:
                lat, lng = COUNTRY_COORDS[c]
                country_map[c] = {"country": c, "lat": lat, "lng": lng, "minerals": [], "raw_inf": 0}
            country_map[c]["minerals"].append({
                "id": m.id, "name": m.name, "name_zh": m.name_zh,
                "symbol": m.symbol, "category": m.category,
                "criticality_score": m.criticality_score,
            })
            country_map[c]["raw_inf"] += (m.criticality_score or 0)

    max_inf = max((v["raw_inf"] for v in country_map.values()), default=1) or 1
    for v in country_map.values():
        v["influence_score"] = round((v["raw_inf"] / max_inf) * 100)
        del v["raw_inf"]

    since_7d  = datetime.utcnow() - timedelta(days=7)
    since_14d = datetime.utcnow() - timedelta(days=14)

    news_r = await db.execute(
        select(NewsArticle.country, func.count(NewsArticle.id))
        .where(and_(NewsArticle.published_at >= since_14d, NewsArticle.country.isnot(None)))
        .group_by(NewsArticle.country)
    )
    news_counts = {row[0]: row[1] for row in news_r.all()}

    policy_r = await db.execute(
        select(NewsArticle.country).where(
            and_(NewsArticle.published_at >= since_14d,
                 NewsArticle.category == "policy",
                 NewsArticle.country.isnot(None))
        ).distinct()
    )
    policy_countries = {row[0] for row in policy_r.all()}

    trigger_r = await db.execute(
        select(PriceAlert.mineral_id)
        .join(AlertTrigger, AlertTrigger.alert_id == PriceAlert.id)
        .where(AlertTrigger.triggered_at >= since_7d).distinct()
    )
    triggered_ids = {row[0] for row in trigger_r.all()}

    alerted: set[str] = set()
    for m in minerals:
        if m.id in triggered_ids:
            for raw in (m.top_producers or []):
                c = _norm(raw)
                if c in country_map:
                    alerted.add(c)

    for c, data in country_map.items():
        if c in alerted:
            data["alert_level"] = "critical"
        elif c in policy_countries:
            data["alert_level"] = "high"
        elif news_counts.get(c, 0) >= 3:
            data["alert_level"] = "medium"
        else:
            data["alert_level"] = "none"
        data["recent_news_count"] = news_counts.get(c, 0)

    return sorted(
        [{"mineral_count": len(v["minerals"]), **v} for v in country_map.values()],
        key=lambda x: -x["influence_score"],
    )


@router.get("/ticker")
async def get_ticker(db: AsyncSession = Depends(get_db)):
    since_48h = datetime.utcnow() - timedelta(hours=48)
    since_7d  = datetime.utcnow() - timedelta(days=7)

    news_r = await db.execute(
        select(NewsArticle)
        .where(NewsArticle.published_at >= since_48h)
        .order_by(NewsArticle.published_at.desc()).limit(20)
    )
    news = news_r.scalars().all()

    price_r = await db.execute(
        select(MineralPrice, Mineral.name_zh, Mineral.name)
        .join(Mineral, Mineral.id == MineralPrice.mineral_id)
        .where(and_(MineralPrice.timestamp >= since_48h,
                    func.abs(MineralPrice.price_change_pct) >= 2.0))
        .order_by(MineralPrice.timestamp.desc()).limit(10)
    )

    trigger_r = await db.execute(
        select(AlertTrigger, PriceAlert, Mineral.name_zh, Mineral.name)
        .join(PriceAlert, PriceAlert.id == AlertTrigger.alert_id)
        .join(Mineral, Mineral.id == PriceAlert.mineral_id)
        .where(AlertTrigger.triggered_at >= since_7d)
        .order_by(AlertTrigger.triggered_at.desc()).limit(5)
    )

    items = []
    for trigger, alert, name_zh, name in trigger_r.all():
        items.append({"type": "alert",
                      "text": f"⚠ 价格预警触发：{name_zh or name} {alert.direction} {alert.threshold}",
                      "ts": trigger.triggered_at.isoformat()})
    for price, name_zh, name in price_r.all():
        pct = price.price_change_pct or 0
        arrow = "▲" if pct >= 0 else "▼"
        items.append({"type": "price",
                      "text": f"{arrow} {name_zh or name}  {'+' if pct>=0 else ''}{pct:.1f}%  {price.price:.2f} {price.unit or ''}",
                      "ts": price.timestamp.isoformat()})
    cat_zh = {"policy": "政策", "industry": "行业", "price": "价格", "corporate": "企业", "exploration": "勘探"}
    for n in news:
        label = cat_zh.get(n.category or "", "资讯")
        items.append({"type": "news", "text": f"[{label}] {n.title}",
                      "url": n.url, "ts": n.published_at.isoformat() if n.published_at else ""})

    items.sort(key=lambda x: x.get("ts", ""), reverse=True)
    return items[:30]


@router.get("/country/{country_name}")
async def get_country_detail(country_name: str, db: AsyncSession = Depends(get_db)):
    since_30d = datetime.utcnow() - timedelta(days=30)
    since_7d  = datetime.utcnow() - timedelta(days=7)

    minerals_r = await db.execute(select(Mineral))
    all_minerals = minerals_r.scalars().all()

    triggered_r = await db.execute(
        select(PriceAlert.mineral_id)
        .join(AlertTrigger, AlertTrigger.alert_id == PriceAlert.id)
        .where(AlertTrigger.triggered_at >= since_7d).distinct()
    )
    triggered_ids = {row[0] for row in triggered_r.all()}

    country_minerals = []
    for m in all_minerals:
        if country_name not in [_norm(p) for p in (m.top_producers or [])]:
            continue
        price_r = await db.execute(
            select(MineralPrice).where(MineralPrice.mineral_id == m.id)
            .order_by(MineralPrice.timestamp.desc()).limit(1)
        )
        lp = price_r.scalar_one_or_none()
        country_minerals.append({
            "id": m.id, "name": m.name, "name_zh": m.name_zh,
            "symbol": m.symbol, "category": m.category,
            "criticality_score": m.criticality_score,
            "latest_price": {"price": lp.price, "price_change_pct": lp.price_change_pct,
                             "unit": lp.unit, "timestamp": lp.timestamp.isoformat()} if lp else None,
        })

    news_r = await db.execute(
        select(NewsArticle)
        .where(and_(NewsArticle.published_at >= since_30d, NewsArticle.country == country_name))
        .order_by(NewsArticle.published_at.desc()).limit(10)
    )
    news = news_r.scalars().all()
    news_dicts = [
        {"id": n.id, "title": n.title, "url": n.url, "source": n.source,
         "category": n.category, "published_at": n.published_at.isoformat() if n.published_at else None,
         "summary": n.summary}
        for n in news
    ]

    risk = _compute_risk(country_name, country_minerals, news_dicts, triggered_ids)

    # Related countries
    related: dict[str, list] = {}
    for m_data in country_minerals:
        m_obj = next((m for m in all_minerals if m.id == m_data["id"]), None)
        if not m_obj:
            continue
        for raw in (m_obj.top_producers or []):
            other = _norm(raw)
            if other != country_name and other in COUNTRY_COORDS:
                related.setdefault(other, []).append(m_data["name_zh"] or m_data["name"])
    related_list = sorted(
        [{"country": c, "shared_minerals": list(set(ms))} for c, ms in related.items()],
        key=lambda x: -len(x["shared_minerals"])
    )[:8]

    companies_r = await db.execute(
        select(Company).where(Company.country == country_name).limit(8)
    )
    companies = companies_r.scalars().all()
    company_list = []
    for co in companies:
        snap = co.snapshots[0] if co.snapshots else None
        company_list.append({
            "id": co.id, "name": co.name, "name_zh": co.name_zh,
            "ticker": co.ticker, "exchange": co.exchange,
            "minerals_focus": co.minerals_focus,
            "latest_snapshot": {"stock_price": snap.stock_price,
                                "price_change_pct": snap.price_change_pct} if snap else None,
        })

    # Mineral share (by criticality weight)
    total_crit = sum(m.get("criticality_score") or 0 for m in country_minerals) or 1
    mineral_share = [
        {"name": m["name_zh"] or m["name"], "value": round((m.get("criticality_score") or 1) / total_crit * 100)}
        for m in sorted(country_minerals, key=lambda x: -(x.get("criticality_score") or 0))[:6]
    ]

    return {
        "country": country_name,
        "minerals": sorted(country_minerals, key=lambda x: -(x.get("criticality_score") or 0)),
        "influence_score": sum((m.get("criticality_score") or 0) for m in country_minerals),
        "risk": risk,
        "mineral_share": mineral_share,
        "mining_sites": KNOWN_MINES.get(country_name, []),
        "recent_news": news_dicts,
        "related_countries": related_list,
        "companies": company_list,
    }
