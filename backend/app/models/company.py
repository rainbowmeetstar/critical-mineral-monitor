from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from ..database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    name_zh = Column(String(200))
    ticker = Column(String(20))          # Yahoo Finance ticker
    exchange = Column(String(20))        # NYSE / ASX / HKEx / SHEx ...
    country = Column(String(100))
    minerals_focus = Column(JSON, default=list)   # list of mineral names
    description = Column(Text)
    description_zh = Column(Text)
    website = Column(String(300))

    snapshots = relationship(
        "CompanySnapshot", back_populates="company",
        cascade="all, delete-orphan",
        order_by="CompanySnapshot.timestamp.desc()",
    )


class CompanySnapshot(Base):
    __tablename__ = "company_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False)
    stock_price = Column(Float)
    price_change_pct = Column(Float)
    market_cap_usd_bn = Column(Float)     # billion USD
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    company = relationship("Company", back_populates="snapshots",
                           primaryjoin="CompanySnapshot.company_id == Company.id",
                           foreign_keys=[company_id])
