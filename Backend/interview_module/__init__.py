from .routes import router as interview_router
from .database import init_db

init_db()

__all__ = ["interview_router"]
