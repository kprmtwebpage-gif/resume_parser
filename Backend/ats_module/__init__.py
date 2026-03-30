from .routes import router as ats_router
from .database import init_db

init_db()

__all__ = ["ats_router"]
