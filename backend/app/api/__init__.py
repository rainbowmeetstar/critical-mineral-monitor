from fastapi import APIRouter
from .minerals import router as minerals_router
from .news import router as news_router
from .stats import router as stats_router
from .crawl import router as crawl_router
from .map import router as map_router
from .export import router as export_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(minerals_router)
api_router.include_router(news_router)
api_router.include_router(stats_router)
api_router.include_router(crawl_router)
api_router.include_router(map_router)
api_router.include_router(export_router)
