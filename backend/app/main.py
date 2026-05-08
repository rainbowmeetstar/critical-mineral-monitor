import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .seed_data import seed_minerals
from .database import AsyncSessionLocal
from .scheduler import start_scheduler, stop_scheduler
from .api import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    await init_db()
    async with AsyncSessionLocal() as db:
        await seed_minerals(db)
    start_scheduler()

    # Trigger initial data fetch on startup
    from .crawlers import NewsCrawler, PriceCrawler
    asyncio.create_task(PriceCrawler().run())
    asyncio.create_task(NewsCrawler().run())

    yield

    stop_scheduler()
    logger.info("Shutting down...")


app = FastAPI(
    title="Critical Mineral Monitor",
    description="Tracks critical mineral prices, policies, and industry news globally.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.cors_allow_all else settings.cors_origins,
    allow_credentials=not settings.cors_allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
