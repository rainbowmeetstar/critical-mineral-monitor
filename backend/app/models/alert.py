from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base


class PriceAlert(Base):
    """User-defined price threshold alert rule."""
    __tablename__ = "price_alerts"

    id = Column(Integer, primary_key=True, index=True)
    mineral_id = Column(Integer, ForeignKey("minerals.id"), nullable=False)
    direction = Column(String(10), nullable=False)   # "above" | "below"
    threshold = Column(Float, nullable=False)
    note = Column(String(200))
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    mineral = relationship("Mineral")
    triggers = relationship("AlertTrigger", back_populates="alert", cascade="all, delete-orphan")


class AlertTrigger(Base):
    """Each time an alert fires, one record is written here."""
    __tablename__ = "alert_triggers"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("price_alerts.id"), nullable=False)
    price_at_trigger = Column(Float, nullable=False)
    triggered_at = Column(DateTime, default=datetime.utcnow, index=True)

    alert = relationship("PriceAlert", back_populates="triggers")
