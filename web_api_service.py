"""
Web API Service - Module 2
===========================
Standalone service that:
1. Reads candidate data from PostgreSQL database
2. Serves REST API endpoints
3. Serves built frontend UI (production mode)
4. Provides search, filtering, and candidate details

Can run as:
- Development: python web_api_service.py --dev
- Production: python web_api_service.py --prod

Docker-ready: All dependencies included, uses environment variables
"""

import os
import sys
import argparse
from pathlib import Path

# Add Backend to path for imports
BACKEND_DIR = Path(__file__).parent / "Backend"
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv()


def check_database_connection():
    """Verify database is accessible before starting server.
    Auto-creates tables if they don't exist yet (fresh DB scenario).
    """
    import psycopg2
    
    try:
        conn = psycopg2.connect(
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
        )
        
        candidates_table = os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile")
        skills_table = os.getenv("NEW_SKILLS_TABLE", "candidate_skills_profile")

        with conn:
            with conn.cursor() as cur:
                # Auto-create tables if they don't exist (idempotent)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS public.job_titles (
                        id SERIAL PRIMARY KEY,
                        job_title TEXT UNIQUE NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """)
                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS {candidates_table} (
                        id SERIAL PRIMARY KEY,
                        first_name TEXT,
                        last_name TEXT,
                        address TEXT,
                        phone TEXT,
                        email TEXT,
                        qualification TEXT,
                        visa_support BOOLEAN,
                        work_authorization_type TEXT,
                        linkedin TEXT,
                        profile_picture_url TEXT,
                        resume_filename TEXT,
                        resume_sha256 TEXT UNIQUE,
                        parsed_at TIMESTAMP,
                        education_structured JSONB
                    )
                """)
                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS {skills_table} (
                        candidate_id INTEGER PRIMARY KEY
                            REFERENCES {candidates_table}(id) ON DELETE CASCADE,
                        job_id INTEGER REFERENCES public.job_titles(id),
                        job_title TEXT,
                        tech_skills TEXT,
                        years_of_experience NUMERIC,
                        certifications TEXT,
                        parsed_at TIMESTAMP
                    )
                """)
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{skills_table}_candidate_id ON {skills_table}(candidate_id)")
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{skills_table}_job_id ON {skills_table}(job_id)")

                cur.execute(f"SELECT COUNT(*) FROM {candidates_table}")
                count = cur.fetchone()[0]
                print(f"✅ Connected to PostgreSQL database")
                print(f"📊 Found {count} candidates in database")
            
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print(f"   Please check your database configuration:")
        print(f"   DB_HOST={os.getenv('DB_HOST')}")
        print(f"   DB_PORT={os.getenv('DB_PORT')}")
        print(f"   DB_NAME={os.getenv('DB_NAME')}")
        print(f"   DB_USER={os.getenv('DB_USER')}")
        return False


def build_frontend_if_needed():
    """Build frontend for production if not already built"""
    frontend_dist = Path(__file__).parent / "Frontend" / "dist"
    
    if not frontend_dist.exists():
        print("⚠️  Frontend not built yet. Building for production...")
        print("   This may take a minute...")
        
        try:
            import subprocess
            frontend_dir = Path(__file__).parent / "Frontend"
            
            # Run npm build
            result = subprocess.run(
                ["npm", "run", "build"],
                cwd=frontend_dir,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode == 0:
                print("✅ Frontend built successfully")
                return True
            else:
                print(f"❌ Frontend build failed:")
                print(result.stderr)
                return False
                
        except subprocess.TimeoutExpired:
            print("❌ Frontend build timed out")
            return False
        except FileNotFoundError:
            print("❌ npm not found. Please install Node.js")
            return False
        except Exception as e:
            print(f"❌ Error building frontend: {e}")
            return False
    else:
        print(f"✅ Frontend already built at: {frontend_dist}")
        return True


def run_development_mode(host="127.0.0.1", port=8000):
    """Run in development mode (API only, separate frontend dev server)"""
    print("="*80)
    print("WEB API SERVICE - DEVELOPMENT MODE")
    print("="*80)
    print(f"🔧 Starting development server...")
    print(f"📍 API will be available at: http://{host}:{port}")
    print(f"📖 API Documentation at: http://{host}:{port}/docs")
    print(f"")
    print(f"ℹ️  In development mode:")
    print(f"   - API server runs on port {port}")
    print(f"   - Run Frontend separately: cd Frontend && npm run dev")
    print(f"   - Frontend will be on http://localhost:5173")
    print("="*80)
    print()
    
    if not check_database_connection():
        return 1
    
    # Import and run FastAPI app
    import uvicorn
    from api_server import app
    
    uvicorn.run(app, host=host, port=port, reload=True)
    return 0


def run_production_mode(host="0.0.0.0", port=8000, workers=4):
    """Run in production mode (API + serves built frontend)"""
    print("="*80)
    print("WEB API SERVICE - PRODUCTION MODE")
    print("="*80)
    print(f"🚀 Starting production server...")
    print(f"📍 Application will be available at: http://localhost:{port}")
    print(f"📖 API Documentation at: http://localhost:{port}/docs")
    print(f"👥 Running with {workers} workers for better performance")
    print("="*80)
    print()
    
    if not check_database_connection():
        return 1
    
    # Check if frontend is built
    frontend_dist = Path(__file__).parent / "Frontend" / "dist"
    if not frontend_dist.exists():
        print("⚠️  Frontend not built. Building now...")
        if not build_frontend_if_needed():
            print("\n❌ Cannot start production server without built frontend")
            print("   Run: cd Frontend && npm run build")
            return 1
    
    # Enable frontend serving
    os.environ["SERVE_FRONTEND"] = "1"
    
    # Import and run FastAPI app with multiple workers
    import uvicorn
    from api_server import app
    
    print(f"✅ Starting server with frontend at: http://localhost:{port}\n")
    
    uvicorn.run(
        "api_server:app",
        host=host,
        port=port,
        workers=workers,
        log_level="info"
    )
    return 0


def main():
    """Main entry point with command-line argument parsing"""
    parser = argparse.ArgumentParser(
        description="Web API Service - Serves candidate data via REST API and UI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Development mode (API only, no frontend serving)
  python web_api_service.py --dev
  
  # Production mode (API + serves built frontend)
  python web_api_service.py --prod
  
  # Production with custom settings
  python web_api_service.py --prod --port 8080 --workers 8
  
Environment Variables Required:
  DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT - Database connection
  NEW_CANDIDATES_TABLE (optional) - Candidates table name
  NEW_SKILLS_TABLE (optional) - Skills table name
        """
    )
    
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Run in development mode (API only, use separate frontend dev server)"
    )
    parser.add_argument(
        "--prod",
        action="store_true",
        help="Run in production mode (API + serves built frontend)"
    )
    parser.add_argument(
        "--host",
        default=None,
        help="Host to bind to (default: 127.0.0.1 for dev, 0.0.0.0 for prod)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to (default: 8000)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Number of worker processes for production mode (default: 4)"
    )
    
    args = parser.parse_args()
    
    # Validate environment
    required_vars = ["DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        print(f"❌ Missing required environment variables: {', '.join(missing)}")
        print(f"   Please set them in Backend/.env file or environment")
        return 1
    
    # Determine host based on mode if not specified
    if args.host is None:
        args.host = "127.0.0.1" if args.dev else "0.0.0.0"
    
    # Run in selected mode
    if args.prod:
        return run_production_mode(args.host, args.port, args.workers)
    elif args.dev:
        return run_development_mode(args.host, args.port)
    else:
        # Default: production mode
        print("ℹ️  No mode specified. Use --dev or --prod")
        print("   Running in production mode by default...\n")
        return run_production_mode(args.host, args.port, args.workers)


if __name__ == "__main__":
    sys.exit(main())
