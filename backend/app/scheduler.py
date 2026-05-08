import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .config import settings
from .crawlers import PriceCrawler, NewsCrawler, USGSCrawler

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def run_price_crawl():
    await PriceCrawler().run()


async def run_news_crawl():
    await NewsCrawler().run()
    await USGSCrawler().run()


def start_scheduler():
    scheduler.add_job(
        run_price_crawl,
        "interval",
        minutes=settings.price_refresh_minutes,
        id="price_crawl",
        replace_existing=True,
    )
    scheduler.add_job(
        run_news_crawl,
        "interval",
        minutes=settings.news_refresh_minutes,
        id="news_crawl",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
