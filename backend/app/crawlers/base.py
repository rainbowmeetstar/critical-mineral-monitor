import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseCrawler(ABC):
    name: str = "base"

    async def run(self) -> dict:
        logger.info(f"[{self.name}] Starting crawl")
        try:
            result = await self.fetch()
            logger.info(f"[{self.name}] Completed: {result}")
            return result
        except Exception as e:
            logger.error(f"[{self.name}] Error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    @abstractmethod
    async def fetch(self) -> dict:
        pass
