import asyncio

from fastapi import APIRouter, BackgroundTasks

from ..crawlers import PriceCrawler, NewsCrawler, USGSCrawler, ChinaPolicyCrawler, CompanyCrawler, ReeSpotPriceCrawler

router = APIRouter(prefix="/crawl", tags=["crawl"])


@router.post("/prices")
async def trigger_price_crawl(background_tasks: BackgroundTasks):
    background_tasks.add_task(PriceCrawler().run)
    background_tasks.add_task(ReeSpotPriceCrawler().run)
    background_tasks.add_task(CompanyCrawler().run)
    return {"status": "Price crawl scheduled"}


@router.post("/news")
async def trigger_news_crawl(background_tasks: BackgroundTasks):
    background_tasks.add_task(NewsCrawler().run)
    background_tasks.add_task(USGSCrawler().run)
    background_tasks.add_task(ChinaPolicyCrawler().run)
    return {"status": "News crawl scheduled"}


@router.post("/all")
async def trigger_all_crawls(background_tasks: BackgroundTasks):
    background_tasks.add_task(PriceCrawler().run)
    background_tasks.add_task(NewsCrawler().run)
    background_tasks.add_task(USGSCrawler().run)
    background_tasks.add_task(ChinaPolicyCrawler().run)
    background_tasks.add_task(ReeSpotPriceCrawler().run)
    background_tasks.add_task(CompanyCrawler().run)
    return {"status": "All crawls scheduled"}
