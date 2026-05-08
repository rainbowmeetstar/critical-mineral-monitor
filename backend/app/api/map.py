from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.mineral import Mineral

router = APIRouter(prefix="/map", tags=["map"])

# Geographic center coordinates for major producing countries
COUNTRY_COORDS: dict[str, tuple[float, float]] = {
    "China": (35.86, 104.19),
    "Australia": (-25.27, 133.77),
    "United States": (37.09, -95.71),
    "Chile": (-35.67, -71.54),
    "DRC": (-4.04, 21.76),
    "Myanmar": (19.16, 96.66),
    "South Africa": (-30.56, 22.94),
    "Russia": (61.52, 105.32),
    "Indonesia": (-0.79, 113.92),
    "Philippines": (12.88, 121.77),
    "Canada": (56.13, -106.35),
    "Brazil": (-14.24, -51.93),
    "Peru": (-9.19, -75.02),
    "Bolivia": (-16.29, -63.59),
    "Mexico": (23.63, -102.55),
    "India": (20.59, 78.96),
    "Kazakhstan": (48.02, 66.92),
    "Vietnam": (14.06, 108.28),
    "Zimbabwe": (-19.02, 29.15),
    "Madagascar": (-18.77, 46.87),
    "Mozambique": (-18.67, 35.53),
    "Tanzania": (-6.37, 34.89),
    "South Korea": (35.91, 127.77),
    "Japan": (36.20, 138.25),
    "Gabon": (-0.80, 11.61),
    "Ukraine": (48.38, 31.17),
    "UAE": (23.42, 53.85),
    "Argentina": (-38.42, -63.62),
    "Norway": (60.47, 8.47),
    "Sweden": (60.13, 18.64),
}


def _normalize_country(raw: str) -> str:
    """Strip parenthetical notes like 'China (>80%)' → 'China'."""
    return raw.split("(")[0].strip()


@router.get("")
async def get_producer_map(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mineral))
    minerals = result.scalars().all()

    country_map: dict[str, dict] = {}

    for mineral in minerals:
        for raw_producer in (mineral.top_producers or []):
            country = _normalize_country(raw_producer)
            if country not in COUNTRY_COORDS:
                continue
            if country not in country_map:
                lat, lng = COUNTRY_COORDS[country]
                country_map[country] = {
                    "country": country,
                    "lat": lat,
                    "lng": lng,
                    "minerals": [],
                }
            country_map[country]["minerals"].append({
                "id": mineral.id,
                "name": mineral.name,
                "name_zh": mineral.name_zh,
                "symbol": mineral.symbol,
                "category": mineral.category,
                "criticality_score": mineral.criticality_score,
            })

    return sorted(
        [{"mineral_count": len(v["minerals"]), **v} for v in country_map.values()],
        key=lambda x: -x["mineral_count"],
    )
