from fastapi import APIRouter
from .minerals import router as minerals_router
from .news import router as news_router
from .stats import router as stats_router
from .crawl import router as crawl_router
from .map import router as map_router
from .export import router as export_router
from .alerts import router as alerts_router
from .companies import router as companies_router
from .forecast import router as forecast_router
from .briefing import router as briefing_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(minerals_router)
api_router.include_router(forecast_router)
api_router.include_router(news_router)
api_router.include_router(stats_router)
api_router.include_router(crawl_router)
api_router.include_router(map_router)
api_router.include_router(export_router)
api_router.include_router(alerts_router)
api_router.include_router(companies_router)
api_router.include_router(briefing_router)
