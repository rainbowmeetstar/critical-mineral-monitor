"""
Briefing generator: returns self-contained HTML pages for enterprise or government audiences.
Supports global (all minerals) and per-mineral briefings.
No external template engine required — HTML is built inline.
"""
from datetime import datetime, timedelta
from math import sqrt

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy import select, desc, func, Text
from sqlalchemy import cast as sa_cast
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.mineral import Mineral, MineralPrice
from ..models.news import NewsArticle
from ..models.company import Company, CompanySnapshot
from ..models.alert import PriceAlert, AlertTrigger

router = APIRouter(prefix="/briefing", tags=["briefing"])

# ── CSS ────────────────────────────────────────────────────────────────────────

_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px; color: #1e293b; background: #f8fafc; line-height: 1.6;
}
.page { max-width: 960px; margin: 0 auto; padding: 24px 24px 48px; }

/* Header */
.hd { display: flex; align-items: flex-start; justify-content: space-between;
  border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 24px; }
.hd-title { font-size: 20px; font-weight: 700; color: #0f172a; }
.hd-sub { font-size: 12px; color: #64748b; margin-top: 3px; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600; }
.badge-ent { background: #dbeafe; color: #1d4ed8; }
.badge-gov { background: #dcfce7; color: #15803d; }

/* Stats row */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
.stat-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 14px 16px; text-align: center; }
.stat-val { font-size: 22px; font-weight: 700; color: #0ea5e9; }
.stat-lbl { font-size: 11px; color: #94a3b8; margin-top: 2px; }

/* Section */
.section { margin-bottom: 28px; }
.section-hd { display: flex; align-items: center; gap-8px; font-size: 14px;
  font-weight: 600; color: #0f172a; padding: 8px 12px;
  background: #f1f5f9; border-left: 4px solid #0ea5e9;
  border-radius: 0 6px 6px 0; margin-bottom: 12px; }
.section-hd .ico { margin-right: 6px; }

/* Table */
table { width: 100%; border-collapse: collapse; background: #fff;
  border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
th { background: #f8fafc; font-size: 11px; font-weight: 600; color: #64748b;
  padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #f8fafc; }

/* Outlook badge */
.ob { display: inline-block; padding: 2px 8px; border-radius: 12px;
  font-size: 11px; font-weight: 600; }
.ob-bull  { background: #dcfce7; color: #15803d; }
.ob-mbull { background: #d1fae5; color: #059669; }
.ob-neu   { background: #f1f5f9; color: #64748b; }
.ob-mbear { background: #fff7ed; color: #c2410c; }
.ob-bear  { background: #fee2e2; color: #dc2626; }
.ob-na    { background: #f1f5f9; color: #94a3b8; }

/* Up/down */
.up   { color: #16a34a; font-weight: 600; }
.down { color: #dc2626; font-weight: 600; }
.neu  { color: #64748b; }

/* News cards */
.news-grid { display: flex; flex-direction: column; gap: 8px; }
.news-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 10px 14px; }
.news-title { font-size: 13px; font-weight: 500; color: #0f172a; margin-bottom: 4px; }
.news-meta  { font-size: 11px; color: #94a3b8; display: flex; gap: 10px; flex-wrap: wrap; }
.cat-badge  { display: inline-block; padding: 1px 7px; border-radius: 10px;
  font-size: 10px; font-weight: 600; }
.cat-policy     { background: #ede9fe; color: #7c3aed; }
.cat-price      { background: #fef3c7; color: #b45309; }
.cat-exploration{ background: #d1fae5; color: #065f46; }
.cat-corporate  { background: #dbeafe; color: #1e40af; }
.cat-industry   { background: #f1f5f9; color: #475569; }

/* Crit score bar */
.crit-bar { display: inline-block; height: 6px; border-radius: 3px;
  background: linear-gradient(90deg, #0ea5e9, #e11d48); vertical-align: middle; }

/* Risk box */
.risk-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px;
  padding: 12px 16px; margin-top: 6px; }
.risk-title { font-size: 12px; font-weight: 600; color: #c2410c; margin-bottom: 6px; }

/* Supply security card */
.mineral-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 12px 14px; margin-bottom: 8px; }
.mineral-card-hd { display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px; }
.mineral-name { font-size: 13px; font-weight: 600; color: #0f172a; }
.mineral-sub  { font-size: 11px; color: #64748b; }
.producers-list { font-size: 11px; color: #475569; margin-top: 4px; }

/* Outlook text box */
.outlook-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;
  padding: 10px 14px; font-size: 12px; color: #0c4a6e; line-height: 1.7; margin-top: 6px; }

/* Footer */
.footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0;
  font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }

/* Print */
@media print {
  body { background: #fff; font-size: 11px; }
  .page { padding: 0; max-width: 100%; }
  .section { page-break-inside: avoid; }
  .stats { gap: 8px; }
  a { text-decoration: none; color: inherit; }
  .no-print { display: none !important; }
}
"""

# ── HTML helpers ───────────────────────────────────────────────────────────────

def _pct(v):
    if v is None: return '<span class="neu">—</span>'
    cls = "up" if v >= 0 else "down"
    sign = "+" if v >= 0 else ""
    return f'<span class="{cls}">{sign}{v:.1f}%</span>'

def _ob_badge(outlook: str) -> str:
    map_ = {"看涨": ("ob-bull", "▲ 看涨"), "温和看涨": ("ob-mbull", "↗ 温和看涨"),
             "中性": ("ob-neu", "— 中性"), "温和看跌": ("ob-mbear", "↘ 温和看跌"),
             "看跌": ("ob-bear", "▼ 看跌"), "数据不足": ("ob-na", "数据不足")}
    cls, label = map_.get(outlook, ("ob-na", outlook))
    return f'<span class="ob {cls}">{label}</span>'

def _cat_badge(cat: str) -> str:
    labels = {"policy": "政策", "price": "价格", "exploration": "勘探",
              "corporate": "企业", "industry": "行业"}
    return f'<span class="cat-badge cat-{cat}">{labels.get(cat, cat)}</span>'

def _section(icon: str, title: str, content: str) -> str:
    return f"""
<div class="section">
  <div class="section-hd"><span class="ico">{icon}</span>{title}</div>
  {content}
</div>"""

def _header(audience: str, scope: str, extra: str = "") -> str:
    aud_label = "企业版" if audience == "enterprise" else "政府版"
    aud_cls   = "badge-ent" if audience == "enterprise" else "badge-gov"
    now = datetime.now().strftime("%Y年%m月%d日 %H:%M")
    return f"""
<div class="hd">
  <div>
    <div class="hd-title">🔬 关键矿产监测简报</div>
    <div class="hd-sub">{scope} &nbsp;·&nbsp; {now} &nbsp;·&nbsp; 数据来源：Yahoo Finance · Google News · USGS</div>
    {extra}
  </div>
  <div style="text-align:right">
    <span class="badge {aud_cls}">{aud_label}</span>
    <div class="hd-sub" style="margin-top:6px">Critical Mineral Monitor</div>
  </div>
</div>"""

def _footer() -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"""
<div class="footer">
  <span>⚠ 本简报仅供参考，数据基于公开来源自动采集，不构成投资或政策建议。</span>
  <span>生成时间：{now}</span>
</div>"""

# ── Simple forecast (inline, no router dep) ────────────────────────────────────

def _quick_forecast(prices: list[float]) -> tuple[str, float | None, float | None]:
    """Returns (outlook_label, ma7, mom30d)."""
    n = len(prices)
    if n < 5:
        return "数据不足", None, None
    ma7  = sum(prices[-7:])  / min(7, n)
    ma30 = sum(prices[-30:]) / min(30, n) if n >= 7 else None
    slope_num = sum((i - (n-1)/2) * (prices[i] - sum(prices)/n) for i in range(n))
    slope_den = sum((i - (n-1)/2)**2 for i in range(n))
    slope = slope_num / slope_den if slope_den else 0
    slope_pct = slope / prices[-1] * 100 if prices[-1] else 0
    mom30 = (prices[-1] - prices[-min(31,n)]) / prices[-min(31,n)] * 100 if n >= 2 else None
    if ma30 and slope_pct > 0.15 and ma7 > ma30:
        outlook = "看涨"
    elif ma30 and slope_pct > 0.05 and ma7 >= ma30 * 0.99:
        outlook = "温和看涨"
    elif ma30 and slope_pct < -0.15 and ma7 < ma30:
        outlook = "看跌"
    elif ma30 and slope_pct < -0.05 and ma7 <= ma30 * 1.01:
        outlook = "温和看跌"
    else:
        outlook = "中性"
    return outlook, round(ma7, 3), round(mom30, 1) if mom30 is not None else None

# ── Data loaders ───────────────────────────────────────────────────────────────

async def _load_minerals_with_prices(db: AsyncSession, mineral_id: int | None = None):
    q = select(Mineral)
    if mineral_id:
        q = q.where(Mineral.id == mineral_id)
    else:
        q = q.order_by(Mineral.criticality_score.desc().nullslast())
    minerals = (await db.execute(q)).scalars().all()

    results = []
    since = datetime.utcnow() - timedelta(days=90)
    for m in minerals:
        pq = await db.execute(
            select(MineralPrice)
            .where(MineralPrice.mineral_id == m.id, MineralPrice.timestamp >= since)
            .order_by(MineralPrice.timestamp)
        )
        rows = pq.scalars().all()
        daily: dict[str, float] = {}
        for r in rows:
            daily[r.timestamp.strftime("%Y-%m-%d")] = r.price
        prices = [daily[k] for k in sorted(daily.keys())]

        latest_price = prices[-1] if prices else None
        prev7  = prices[-min(8, len(prices))]  if len(prices) >= 2 else None
        prev30 = prices[-min(31, len(prices))] if len(prices) >= 2 else None
        mom7  = (prices[-1] - prev7)  / prev7  * 100 if prev7  else None
        mom30 = (prices[-1] - prev30) / prev30 * 100 if prev30 else None
        outlook, ma7, _ = _quick_forecast(prices)
        unit = rows[0].unit if rows else None
        results.append({
            "mineral": m, "latest": latest_price, "unit": unit,
            "mom7": mom7, "mom30": mom30, "outlook": outlook, "ma7": ma7,
            "prices": prices,
        })
    return results

async def _load_news(db: AsyncSession, days: int = 30, categories: list[str] | None = None,
                     mineral_name: str | None = None, limit: int = 20):
    since = datetime.utcnow() - timedelta(days=days)
    q = select(NewsArticle).where(NewsArticle.published_at >= since)
    if categories:
        from sqlalchemy import or_
        q = q.where(NewsArticle.category.in_(categories))
    if mineral_name:
        from sqlalchemy import or_
        q = q.where(or_(
            sa_cast(NewsArticle.minerals_mentioned, Text).ilike(f"%{mineral_name}%"),
        ))
    q = q.order_by(NewsArticle.published_at.desc()).limit(limit)
    return (await db.execute(q)).scalars().all()

async def _load_companies(db: AsyncSession):
    companies = (await db.execute(select(Company))).scalars().all()
    result = []
    for c in companies:
        sq = await db.execute(
            select(CompanySnapshot).where(CompanySnapshot.company_id == c.id)
            .order_by(CompanySnapshot.timestamp.desc()).limit(1)
        )
        snap = sq.scalar_one_or_none()
        result.append({"company": c, "snap": snap})
    return result

async def _load_triggered_alerts(db: AsyncSession, days: int = 7):
    since = datetime.utcnow() - timedelta(days=days)
    q = select(AlertTrigger).where(AlertTrigger.triggered_at >= since).order_by(AlertTrigger.triggered_at.desc()).limit(10)
    return (await db.execute(q)).scalars().all()

# ── Section builders ────────────────────────────────────────────────────────────

def _build_price_table(mineral_data: list, gov_mode: bool = False) -> str:
    rows_html = ""
    for d in mineral_data:
        m = d["mineral"]
        if d["latest"] is None:
            continue
        name = m.name_zh or m.name
        price_str = f"{d['latest']:.3f}"
        unit_str = d["unit"] or m.price_unit or ""
        crit = m.criticality_score
        crit_html = f'<span style="font-size:11px;color:#94a3b8">{crit}/10</span>' if crit else "—"
        outlook_html = _ob_badge(d["outlook"])
        rows_html += f"""<tr>
          <td><strong>{name}</strong><br><span style="font-size:11px;color:#94a3b8">{m.name}</span></td>
          <td>{price_str} <span style="font-size:10px;color:#94a3b8">{unit_str}</span></td>
          <td>{_pct(d['mom7'])}</td>
          <td>{_pct(d['mom30'])}</td>
          {"<td>" + crit_html + "</td>" if gov_mode else ""}
          <td>{outlook_html}</td>
        </tr>"""
    extra_th = "<th>关键度</th>" if gov_mode else ""
    html = f"""<table>
      <thead><tr>
        <th>矿产</th><th>当前价格</th><th>7日涨跌</th><th>30日涨跌</th>{extra_th}<th>展望信号</th>
      </tr></thead>
      <tbody>{rows_html}</tbody>
    </table>"""
    return html


def _build_news_cards(articles, limit: int = 10) -> str:
    if not articles:
        return '<p style="color:#94a3b8;font-size:12px">暂无相关资讯</p>'
    items = ""
    for a in articles[:limit]:
        title = a.title[:90] + ("…" if len(a.title) > 90 else "")
        source = a.source or "未知来源"
        cat = _cat_badge(a.category or "industry")
        date = a.published_at.strftime("%m-%d") if a.published_at else ""
        minerals = ""
        if a.minerals_mentioned:
            tags = "".join(f'<span style="background:#f1f5f9;border-radius:4px;padding:1px 5px;font-size:10px;margin-right:3px">{mn}</span>'
                          for mn in (a.minerals_mentioned or [])[:3])
            minerals = f'<div style="margin-top:4px">{tags}</div>'
        items += f"""<div class="news-item">
          <div class="news-title">{title}</div>
          <div class="news-meta">{cat} <span>{source}</span> <span>{date}</span></div>
          {minerals}
        </div>"""
    return f'<div class="news-grid">{items}</div>'


def _build_company_table(company_data: list) -> str:
    rows = ""
    for d in company_data:
        c, snap = d["company"], d["snap"]
        if snap is None:
            continue
        name = c.name_zh or c.name
        ticker = f"{c.ticker} · {c.exchange}" if c.ticker else "—"
        price = f"{snap.stock_price:.2f}" if snap.stock_price else "—"
        mcap = f"~${snap.market_cap_usd_bn:.1f}B" if snap.market_cap_usd_bn else "—"
        minerals = ", ".join((c.minerals_focus or [])[:3])
        rows += f"""<tr>
          <td><strong>{name}</strong><br><span style="font-size:11px;color:#94a3b8">{ticker}</span></td>
          <td>{price}</td>
          <td>{_pct(snap.price_change_pct)}</td>
          <td>{mcap}</td>
          <td style="font-size:11px;color:#64748b">{minerals}</td>
        </tr>"""
    if not rows:
        return '<p style="color:#94a3b8;font-size:12px">暂无企业数据</p>'
    return f"""<table>
      <thead><tr><th>公司</th><th>股价</th><th>涨跌</th><th>市值</th><th>主要矿产</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>"""


def _build_supply_security(mineral_data: list) -> str:
    # Government focus: high criticality minerals, their top producers
    cards = ""
    high_crit = [d for d in mineral_data if d["mineral"].criticality_score and d["mineral"].criticality_score >= 7]
    for d in high_crit[:10]:
        m = d["mineral"]
        name = m.name_zh or m.name
        crit = m.criticality_score or 0
        bar_width = int(crit / 10 * 80)
        producers = "、".join((m.top_producers or [])[:4]) if m.top_producers else "数据待补充"
        uses = "、".join((m.key_uses or [])[:3]) if m.key_uses else ""
        outlook = _ob_badge(d["outlook"])
        price_str = f"{d['latest']:.3f} {d['unit'] or ''}" if d["latest"] else "暂无数据"
        cards += f"""<div class="mineral-card">
          <div class="mineral-card-hd">
            <div>
              <span class="mineral-name">{name}</span>
              <span class="mineral-sub" style="margin-left:8px">{m.name} · {m.category or ''}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              {outlook}
              <span style="font-size:11px;color:#64748b">关键度 {crit}/10
                <span class="crit-bar" style="width:{bar_width}px;display:inline-block;margin-left:4px"></span>
              </span>
            </div>
          </div>
          <div class="producers-list">📍 主产国：{producers}</div>
          {"<div style='font-size:11px;color:#64748b;margin-top:3px'>🔧 主要用途：" + uses + "</div>" if uses else ""}
          <div style="font-size:11px;color:#475569;margin-top:4px">当前价格：{price_str} &nbsp; 30日涨跌：{_pct(d['mom30'])}</div>
        </div>"""
    return cards or '<p style="color:#94a3b8;font-size:12px">暂无高关键度矿产数据</p>'


def _build_risk_section(alerts_triggered: list, volatile_minerals: list) -> str:
    items = []
    if alerts_triggered:
        items.append(f'<div class="risk-title">⚠ 价格预警触发（近7日 {len(alerts_triggered)} 次）</div>')
        for t in alerts_triggered[:5]:
            items.append(f'<div style="font-size:12px;color:#92400e;padding:3px 0">触发于 {t.triggered_at.strftime("%m-%d %H:%M")} · 价格 {t.price_at_trigger:.3f}</div>')
    if volatile_minerals:
        items.append(f'<div class="risk-title" style="margin-top:10px">📊 高波动矿产</div>')
        for name, vol in volatile_minerals[:5]:
            items.append(f'<div style="font-size:12px;color:#92400e;padding:2px 0">{name} · 近期价格波动显著</div>')
    if not items:
        items.append('<div style="font-size:12px;color:#15803d">✓ 当前未检测到重大风险信号</div>')
    return f'<div class="risk-box">{"".join(items)}</div>'

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/global", response_class=HTMLResponse)
async def global_briefing(
    audience: str = Query(default="enterprise", regex="^(enterprise|government)$"),
    db: AsyncSession = Depends(get_db),
):
    mineral_data = await _load_minerals_with_prices(db)
    company_data = await _load_companies(db)
    alerts = await _load_triggered_alerts(db)

    # Stats
    minerals_with_price = sum(1 for d in mineral_data if d["latest"] is not None)
    bull_count = sum(1 for d in mineral_data if d["outlook"] in ("看涨", "温和看涨"))
    bear_count = sum(1 for d in mineral_data if d["outlook"] in ("看跌", "温和看跌"))

    stats_html = f"""<div class="stats">
      <div class="stat-box"><div class="stat-val">{len(mineral_data)}</div><div class="stat-lbl">追踪矿产</div></div>
      <div class="stat-box"><div class="stat-val">{minerals_with_price}</div><div class="stat-lbl">有价格数据</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#16a34a">{bull_count}</div><div class="stat-lbl">看涨信号</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#dc2626">{bear_count}</div><div class="stat-lbl">看跌信号</div></div>
    </div>"""

    if audience == "enterprise":
        news = await _load_news(db, days=14, categories=["price", "corporate", "industry"])
        volatile = [(d["mineral"].name_zh or d["mineral"].name, d["mom30"])
                    for d in mineral_data if d["mom30"] and abs(d["mom30"]) > 10]

        body = (
            _section("💹", "价格行情总览", _build_price_table(mineral_data))
            + _section("🏭", "矿企股价动态", _build_company_table(company_data))
            + _section("📰", "市场资讯摘要（近14日）", _build_news_cards(news))
            + _section("⚠️", "风险提示", _build_risk_section(alerts, volatile))
        )
        scope = "全局综合简报"
    else:
        news_policy = await _load_news(db, days=30, categories=["policy"])
        news_exploration = await _load_news(db, days=30, categories=["exploration"])
        volatile = [(d["mineral"].name_zh or d["mineral"].name, d["mom30"])
                    for d in mineral_data if d["mom30"] and abs(d["mom30"]) > 8]

        body = (
            _section("🔐", "战略矿产供应安全评估", _build_supply_security(mineral_data))
            + _section("📋", "价格行情总览", _build_price_table(mineral_data, gov_mode=True))
            + _section("📜", "政策与监管动态（近30日）", _build_news_cards(news_policy, limit=15))
            + _section("⛏️", "勘探与开发资讯（近30日）", _build_news_cards(news_exploration))
            + _section("⚠️", "风险提示", _build_risk_section(alerts, volatile))
        )
        scope = "战略矿产安全简报"

    html = f"""<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>关键矿产监测简报 — {'企业版' if audience == 'enterprise' else '政府版'}</title>
<style>{_CSS}</style>
</head><body><div class="page">
{_header(audience, scope)}
{stats_html}
{body}
{_footer()}
<div class="no-print" style="margin-top:24px;text-align:center">
  <button onclick="window.print()" style="padding:8px 20px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
    🖨 打印 / 导出 PDF
  </button>
</div>
</div></body></html>"""
    return HTMLResponse(content=html)


@router.get("/active-countries")
async def active_countries(
    days: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    """Return countries with recent news activity, sorted by article count."""
    from collections import Counter
    since = datetime.utcnow() - timedelta(days=days)
    articles = (await db.execute(
        select(NewsArticle)
        .where(NewsArticle.published_at >= since, NewsArticle.country.isnot(None))
    )).scalars().all()

    counts: Counter = Counter()
    for a in articles:
        c = (a.country or "").strip()
        if c:
            counts[c] += 1

    return [{"country": k, "count": v} for k, v in counts.most_common(20)]


def _build_country_gov_section(country: str, articles: list, mineral_data: list) -> str:
    """Government view: policy trends, trade, diplomatic moves."""
    policy_news = [a for a in articles if a.category in ("policy", "exploration", "industry")]
    other_news  = [a for a in articles if a not in policy_news]

    minerals_str = ", ".join(set(
        mn for a in articles for mn in (a.minerals_mentioned or [])
    ))[:120] or "—"

    items = []
    # Policy section
    if policy_news:
        items.append('<div style="margin-bottom:10px">')
        items.append('<div style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:6px">📜 政策动向与举措</div>')
        for a in policy_news[:5]:
            date = a.published_at.strftime("%m-%d") if a.published_at else ""
            cat_html = _cat_badge(a.category or "policy")
            title = a.title[:100] + ("…" if len(a.title) > 100 else "")
            summary = (a.summary or "")[:150] + ("…" if a.summary and len(a.summary) > 150 else "")
            items.append(f'''<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:5px">
              <div style="font-size:12px;font-weight:500;color:#0f172a">{title}</div>
              {"<div style='font-size:11px;color:#475569;margin-top:3px'>" + summary + "</div>" if summary else ""}
              <div style="font-size:10px;color:#94a3b8;margin-top:4px">{cat_html} {date}</div>
            </div>''')
        items.append('</div>')

    # Trade / other news
    if other_news:
        items.append('<div style="margin-bottom:10px">')
        items.append('<div style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:6px">🤝 贸易与外交动态</div>')
        for a in other_news[:3]:
            date = a.published_at.strftime("%m-%d") if a.published_at else ""
            title = a.title[:100] + ("…" if len(a.title) > 100 else "")
            items.append(f'''<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:5px">
              <div style="font-size:12px;font-weight:500;color:#0f172a">{title}</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">{date}</div>
            </div>''')
        items.append('</div>')

    # Involved minerals note
    if minerals_str != "—":
        items.append(f'<div style="font-size:11px;color:#475569;background:#f1f5f9;padding:8px 12px;border-radius:6px">⛏ 涉及矿产：{minerals_str}</div>')

    return "".join(items)


def _build_country_ent_section(country: str, articles: list, mineral_data: list) -> str:
    """Enterprise view: prices, risk alerts, purchase recommendations."""
    involved_minerals = set(mn for a in articles for mn in (a.minerals_mentioned or []))
    relevant_mdata = [d for d in mineral_data if (d["mineral"].name in involved_minerals or (d["mineral"].name_zh and d["mineral"].name_zh in involved_minerals))]

    items = []

    # Price table for relevant minerals
    if relevant_mdata:
        rows = ""
        for d in relevant_mdata[:8]:
            if d["latest"] is None:
                continue
            m = d["mineral"]
            name = m.name_zh or m.name
            outlook = _ob_badge(d["outlook"])
            mom7_html = _pct(d["mom7"])
            mom30_html = _pct(d["mom30"])
            risk_flag = "⚠ 波动显著" if d["mom30"] and abs(d["mom30"]) > 15 else ""
            advice = ""
            if d["outlook"] in ("看涨",):
                advice = '<span style="color:#16a34a;font-weight:600">建议提前锁价</span>'
            elif d["outlook"] in ("看跌",):
                advice = '<span style="color:#64748b">可等待低位建仓</span>'
            else:
                advice = '<span style="color:#64748b">维持正常采购节奏</span>'
            rows += f"""<tr>
              <td><strong>{name}</strong> {f'<span style="font-size:10px;color:#dc2626">{risk_flag}</span>' if risk_flag else ''}</td>
              <td>{d['latest']:.3f} <span style="font-size:10px;color:#94a3b8">{d['unit'] or ''}</span></td>
              <td>{mom7_html}</td><td>{mom30_html}</td>
              <td>{outlook}</td>
              <td>{advice}</td>
            </tr>"""
        if rows:
            items.append(f"""<div style="margin-bottom:10px">
              <div style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:6px">💹 相关矿产价格与购买建议</div>
              <table><thead><tr><th>矿产</th><th>当前价格</th><th>7日</th><th>30日</th><th>展望</th><th>建议</th></tr></thead>
              <tbody>{rows}</tbody></table></div>""")

    # Risk news: policy category or articles with risk keywords in title
    risk_news = [a for a in articles if a.category == "policy" or any(
        kw in (a.title or "") for kw in ("制裁", "禁止", "限制", "冲突", "封锁", "中断", "出口管制")
    )]
    if risk_news:
        items.append('<div style="margin-bottom:10px">')
        items.append('<div style="font-size:12px;font-weight:600;color:#c2410c;margin-bottom:6px">⚠ 风险提示</div>')
        for a in risk_news[:4]:
            date = a.published_at.strftime("%m-%d") if a.published_at else ""
            title = a.title[:100] + ("…" if len(a.title) > 100 else "")
            items.append(f'''<div class="risk-box" style="margin-bottom:5px">
              <div style="font-size:12px;color:#92400e">{title}</div>
              <div style="font-size:10px;color:#b45309;margin-top:3px">{date}</div>
            </div>''')
        items.append('</div>')

    # General news
    other = [a for a in articles if a not in risk_news]
    if other:
        items.append('<div>')
        items.append('<div style="font-size:12px;font-weight:600;color:#0f172a;margin-bottom:6px">📰 市场资讯</div>')
        for a in other[:4]:
            date = a.published_at.strftime("%m-%d") if a.published_at else ""
            title = a.title[:100] + ("…" if len(a.title) > 100 else "")
            items.append(f'''<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:5px">
              <div style="font-size:12px;color:#0f172a">{title}</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">{date}</div>
            </div>''')
        items.append('</div>')

    return "".join(items)


@router.get("/country", response_class=HTMLResponse)
async def country_briefing(
    audience: str = Query(default="enterprise", regex="^(enterprise|government)$"),
    days: int = Query(default=7, ge=1, le=30),
    country: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Per-country briefing: summarise recent activity for one or all active countries."""
    from collections import defaultdict
    since = datetime.utcnow() - timedelta(days=days)
    q = select(NewsArticle).where(
        NewsArticle.published_at >= since,
        NewsArticle.country.isnot(None),
    )
    if country:
        q = q.where(NewsArticle.country.ilike(f"%{country}%"))
    q = q.order_by(NewsArticle.published_at.desc()).limit(300)
    all_articles = (await db.execute(q)).scalars().all()

    mineral_data = await _load_minerals_with_prices(db)

    # Group articles by country
    country_articles: dict[str, list] = defaultdict(list)
    for a in all_articles:
        c = (a.country or "").strip()
        if c:
            country_articles[c].append(a)

    # If specific country filter but no country-tagged results, show all articles for that country
    if country and not country_articles:
        country_articles[country] = list(all_articles)

    # Sort countries by article count
    sorted_countries = sorted(country_articles.items(), key=lambda x: -len(x[1]))[:12]

    now = datetime.now().strftime("%Y年%m月%d日 %H:%M")
    period = f"近{days}日"
    aud_label = "企业版" if audience == "enterprise" else "政府版"
    aud_cls   = "badge-ent" if audience == "enterprise" else "badge-gov"
    scope = f"国家动态简报 · {period}"

    if not sorted_countries:
        body = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:14px">暂无符合条件的国家动态数据</div>'
    else:
        sections = []
        for cname, articles in sorted_countries:
            deduped = list({a.id: a for a in articles}.values())
            deduped.sort(key=lambda a: a.published_at or datetime.min, reverse=True)

            if audience == "government":
                inner = _build_country_gov_section(cname, deduped, mineral_data)
            else:
                inner = _build_country_ent_section(cname, deduped, mineral_data)

            count = len(deduped)
            sections.append(f"""
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;page-break-inside:avoid">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #f1f5f9">
    <div style="font-size:16px;font-weight:700;color:#0f172a">🌏 {cname}</div>
    <div style="font-size:11px;color:#94a3b8">{period}动态 · {count} 条资讯</div>
  </div>
  {inner}
</div>""")

        body = "\n".join(sections)

    stats_html = f"""<div class="stats">
      <div class="stat-box"><div class="stat-val">{len(sorted_countries)}</div><div class="stat-lbl">活跃国家</div></div>
      <div class="stat-box"><div class="stat-val">{len(all_articles)}</div><div class="stat-lbl">相关资讯</div></div>
      <div class="stat-box"><div class="stat-val">{days}</div><div class="stat-lbl">统计天数</div></div>
      <div class="stat-box"><div class="stat-val">{aud_label}</div><div class="stat-lbl">简报类型</div></div>
    </div>"""

    html = f"""<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>关键矿产国家动态简报 — {aud_label}</title>
<style>{_CSS}</style>
</head><body><div class="page">
<div class="hd">
  <div>
    <div class="hd-title">🔬 关键矿产监测简报</div>
    <div class="hd-sub">{scope} &nbsp;·&nbsp; {now} &nbsp;·&nbsp; 数据来源：Yahoo Finance · Google News · USGS</div>
  </div>
  <div style="text-align:right">
    <span class="badge {aud_cls}">{aud_label}</span>
    <div class="hd-sub" style="margin-top:6px">Critical Mineral Monitor</div>
  </div>
</div>
{stats_html}
{body}
{_footer()}
<div class="no-print" style="margin-top:24px;text-align:center">
  <button onclick="window.print()" style="padding:8px 20px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
    🖨 打印 / 导出 PDF
  </button>
</div>
</div></body></html>"""
    return HTMLResponse(content=html)


@router.get("/mineral/{mineral_id}", response_class=HTMLResponse)
async def mineral_briefing(
    mineral_id: int,
    audience: str = Query(default="enterprise", regex="^(enterprise|government)$"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Mineral).where(Mineral.id == mineral_id))
    mineral = result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(status_code=404, detail="Mineral not found")

    mineral_data = await _load_minerals_with_prices(db, mineral_id=mineral_id)
    d = mineral_data[0] if mineral_data else {}
    m = mineral

    name = m.name_zh or m.name
    news = await _load_news(db, days=30, mineral_name=m.name, limit=15)
    if m.name_zh:
        news_zh = await _load_news(db, days=30, mineral_name=m.name_zh, limit=10)
        # merge dedup
        seen = {a.id for a in news}
        news = news + [a for a in news_zh if a.id not in seen]
    news.sort(key=lambda a: a.published_at or datetime.min, reverse=True)

    alerts = await _load_triggered_alerts(db)

    # Profile section
    uses = "、".join((m.key_uses or [])[:5]) if m.key_uses else "—"
    producers = "、".join((m.top_producers or [])[:5]) if m.top_producers else "—"
    profile_html = f"""<table>
      <tr><th style="width:120px">中文名</th><td>{m.name_zh or '—'}</td>
          <th style="width:120px">类别</th><td>{m.category or '—'}</td></tr>
      <tr><th>关键度评分</th><td>{m.criticality_score or '—'}/10</td>
          <th>价格单位</th><td>{m.price_unit or '—'}</td></tr>
      <tr><th>主要用途</th><td colspan="3">{uses}</td></tr>
      <tr><th>主要产国</th><td colspan="3">{producers}</td></tr>
    </table>"""

    # Price snapshot
    latest = d.get("latest")
    price_snapshot = f"""<table>
      <thead><tr><th>当前价格</th><th>7日涨跌</th><th>30日涨跌</th><th>MA7</th><th>展望信号</th></tr></thead>
      <tbody><tr>
        <td><strong>{f"{latest:.3f}" if latest else "—"}</strong> <span style="font-size:11px;color:#94a3b8">{d.get('unit','')}</span></td>
        <td>{_pct(d.get('mom7'))}</td>
        <td>{_pct(d.get('mom30'))}</td>
        <td>{d.get('ma7','—')}</td>
        <td>{_ob_badge(d.get('outlook','数据不足'))}</td>
      </tr></tbody>
    </table>"""

    # Filter news by audience
    if audience == "enterprise":
        ent_news = [a for a in news if a.category in ("price", "corporate", "industry", None)]
        body = (
            _section("📋", "矿产概况", profile_html)
            + _section("💹", "价格快照", price_snapshot)
            + _section("📰", "相关市场资讯（近30日）", _build_news_cards(ent_news))
            + _section("⚠️", "风险提示", _build_risk_section(alerts, []))
        )
    else:
        gov_news = [a for a in news if a.category in ("policy", "exploration", "industry", None)]
        crit = m.criticality_score or 0
        supply_note = ""
        if crit >= 8:
            supply_note = f'<div class="risk-box"><div class="risk-title">战略重要性：高关键度矿产（{crit}/10）</div><div style="font-size:12px;color:#92400e">该矿产供应集中度高，地缘政治风险敏感，建议优先纳入供应链安全监测。</div></div>'
        elif crit >= 5:
            supply_note = f'<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;font-size:12px;color:#166534">关键度适中（{crit}/10），建议持续关注主产国政策动向。</div>'
        body = (
            _section("📋", "矿产战略概况", profile_html)
            + _section("🔐", "供应安全评估", supply_note + price_snapshot)
            + _section("📜", "政策与勘探动态（近30日）", _build_news_cards(gov_news))
            + _section("⚠️", "风险提示", _build_risk_section(alerts, []))
        )

    scope = f"{name} 矿产{'市场分析简报' if audience == 'enterprise' else '战略安全简报'}"
    html = f"""<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{scope}</title>
<style>{_CSS}</style>
</head><body><div class="page">
{_header(audience, scope)}
{body}
{_footer()}
<div class="no-print" style="margin-top:24px;text-align:center">
  <button onclick="window.print()" style="padding:8px 20px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
    🖨 打印 / 导出 PDF
  </button>
</div>
</div></body></html>"""
    return HTMLResponse(content=html)
