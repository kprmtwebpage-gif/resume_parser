from .routes import router as jobs_router
from .public_routes import router as public_jobs_router
from .database import engine, Base, init_db

# Initialize database tables on module import (creates job_applications table if missing)
init_db()

__all__ = ["jobs_router", "public_jobs_router", "engine", "Base", "init_db"]
