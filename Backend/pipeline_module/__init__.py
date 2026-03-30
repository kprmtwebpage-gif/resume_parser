from .routes import router as pipeline_router
from .database import init_db

init_db()

__all__ = ["pipeline_router"]
