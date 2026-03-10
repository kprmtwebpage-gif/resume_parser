from .routes import router as candidate_comments_router
from .database import init_db

# Initialize database tables on module import (creates candidate_comments table)
init_db()

__all__ = ["candidate_comments_router"]
