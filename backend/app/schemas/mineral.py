from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PriceOut(BaseModel):
    id: int
    mineral_id: int
    price: float
    price_change_pct: Optional[float] = None
    unit: Optional[str] = None
    source: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class MineralOut(BaseModel):
    id: int
    name: str
    name_zh: Optional[str] = None
    symbol: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    atomic_number: Optional[int] = None
    key_uses: Optional[list] = None
    top_producers: Optional[list] = None
    price_unit: Optional[str] = None
    criticality_score: Optional[int] = None
    latest_price: Optional[PriceOut] = None

    class Config:
        from_attributes = True


class MineralDetail(MineralOut):
    description: Optional[str] = None
    description_zh: Optional[str] = None
    yahoo_symbol: Optional[str] = None


class PriceHistory(BaseModel):
    mineral_id: int
    mineral_name: str
    symbol: Optional[str] = None
    unit: Optional[str] = None
    prices: list[PriceOut]
