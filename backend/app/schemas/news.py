from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NewsArticleOut(BaseModel):
    id: int
    title: str
    url: Optional[str] = None
    source: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None
    country: Optional[str] = None
    published_at: Optional[datetime] = None
    summary: Optional[str] = None
    minerals_mentioned: Optional[list] = None
    created_at: datetime

    class Config:
        from_attributes = True
