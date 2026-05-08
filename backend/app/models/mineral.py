from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from ..database import Base


class Mineral(Base):
    __tablename__ = "minerals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    name_zh = Column(String(100))
    symbol = Column(String(10))
    category = Column(String(50))  # rare_earth, battery, strategic, pgm, industrial
    subcategory = Column(String(50))  # LREE, HREE, battery_metal, etc.
    description = Column(Text)
    description_zh = Column(Text)
    atomic_number = Column(Integer)
    key_uses = Column(JSON, default=list)
    top_producers = Column(JSON, default=list)
    yahoo_symbol = Column(String(20))  # Yahoo Finance ticker for price data
    price_unit = Column(String(30), default="USD/t")
    criticality_score = Column(Integer)  # 1-10 strategic importance

    prices = relationship("MineralPrice", back_populates="mineral", cascade="all, delete-orphan")


class MineralPrice(Base):
    __tablename__ = "mineral_prices"

    id = Column(Integer, primary_key=True, index=True)
    mineral_id = Column(Integer, ForeignKey("minerals.id"), nullable=False)
    price = Column(Float, nullable=False)
    price_change_pct = Column(Float)  # percentage change from previous
    unit = Column(String(30))
    source = Column(String(100))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    mineral = relationship("Mineral", back_populates="prices")
