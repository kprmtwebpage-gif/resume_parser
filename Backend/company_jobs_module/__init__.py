from .routes import router as company_jobs_router
from .database import init_db

# Initialize database tables on module import (creates company_jobs table)
init_db()

__all__ = ["company_jobs_router"]
