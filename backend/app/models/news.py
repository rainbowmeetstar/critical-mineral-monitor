from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from ..database import Base


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    url = Column(String(1000), unique=True)
    source = Column(String(100))
    category = Column(String(50))  # policy, industry, price, corporate, exploration
    level = Column(String(50))     # government, industry_assoc, corporate
    country = Column(String(100))
    published_at = Column(DateTime, index=True)
    summary = Column(Text)
    minerals_mentioned = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
