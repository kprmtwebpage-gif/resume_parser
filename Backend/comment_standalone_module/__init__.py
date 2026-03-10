from .routes import router as standalone_comments_router
from .database import init_db

# Initialize database tables on module import (creates standalone_candidate_comments table)
init_db()

__all__ = ["standalone_comments_router"]
