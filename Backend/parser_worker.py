"""
parser_worker.py
================
Worker process initialization and task functions for ProcessPoolExecutor.

Each worker process loads all heavy Python modules and ML models ONCE at
startup via ``worker_init()``.  Subsequent calls to ``parse_one()`` skip the
~30-second module-loading overhead and complete in ~5-7 seconds (parse + LLM).

Architecture
────────────
api_server.py creates:
    ProcessPoolExecutor(max_workers=N, initializer=worker_init)

On pool creation each worker process runs:
    worker_init()  →  imports parser, spaCy, GLiNER (~30s once per worker)

For every uploaded resume api_server calls:
    loop.run_in_executor(_parse_pool, parse_one, env_dict)
        └─► parse_one() runs in the worker (models already loaded) ~5-7s

Result
──────
50 resumes / 2 workers = 25 sequential batches × ~7s = ~3 min  (was 45+ min)
50 resumes / 3 workers = 17 sequential batches × ~7s = ~2 min

NOTE  These functions must be at module level (not closures) so they
      can be pickled and sent to worker processes on Windows.
"""
from __future__ import annotations

import io
import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Worker initializer — runs ONCE per worker process at pool creation time
# ─────────────────────────────────────────────────────────────────────────────

def worker_init() -> None:
    """Pre-load all heavy modules and ML models into this worker process.

    Called by ProcessPoolExecutor when it spawns the worker.  The one-time
    ~30s startup cost is paid here so every parse_one() call can skip it.
    """
    # Ensure Backend directory is on sys.path so all local imports resolve.
    _backend = str(Path(__file__).parent.resolve())
    if _backend not in sys.path:
        sys.path.insert(0, _backend)

    # Silence noisy third-party warnings during initialisation.
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    # Disable GLiNER in worker processes: torch/transformers segfaults on Windows
    # multiprocessing (spawn method). GLiNER is redundant with PARSE_MODE=llm_first.
    os.environ["GLINER_ENABLED"] = "0"

    # ── Step 1: import parser module ────────────────────────────────────────
    # This triggers all of parser.py's module-level imports:
    #   pdfminer, pdfplumber, spaCy, pandas, numpy, regex, dotenv, etc.
    # After this, subsequent calls to parser.main() are virtually free.
    try:
        import parser as _p  # noqa: F401 — side-effect import
        logger.info("parser_worker[init]: parser module loaded")
    except Exception as exc:
        logger.warning("parser_worker[init]: parser import failed: %s", exc)
        return  # Worker is unusable; pool will fall back to subprocess path

    # ── Step 2: pre-load spaCy model ────────────────────────────────────────
    try:
        import spacy  # noqa: F401
        spacy.load("en_core_web_sm")
        logger.info("parser_worker[init]: spaCy model loaded")
    except Exception as exc:
        logger.warning("parser_worker[init]: spaCy pre-load failed: %s", exc)

    logger.info("parser_worker[init]: worker ready — all models in memory")


# ─────────────────────────────────────────────────────────────────────────────
# Task function — called for EACH resume submitted to the pool
# ─────────────────────────────────────────────────────────────────────────────

def parse_one(env_dict: dict[str, str]) -> tuple[int, str, str]:
    """Parse a single resume file in a pre-warmed worker process.

    Args:
        env_dict: Environment variables for this parse task.
                  Must include at minimum:
                  - RESUME_PROCESS_ONLY  (filename to process)
                  - RESUME_INPUT_DIR     (directory containing the file)
                  - DB_NAME / DB_USER / DB_PASSWORD / DB_HOST / DB_PORT

    Returns:
        (returncode, stdout_str, stderr_str)
        where returncode == 0 indicates success.
    """
    # Update process env for this specific file.
    # Each worker handles tasks sequentially so env vars are isolated.
    # Force GLINER_ENABLED=0: torch/GLiNER segfaults in Windows process pool.
    env_dict["GLINER_ENABLED"] = "0"
    os.environ.update(env_dict)

    # Capture stdout / stderr produced by parser.main() so the caller can
    # inspect them (e.g. to detect "NotAResume" or parse errors).
    _saved_stdout = sys.stdout
    _saved_stderr = sys.stderr
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()

    returncode = 0
    try:
        # parser module is already imported (cached from worker_init).
        # Calling main() skips ALL module-level import overhead.
        from parser import main as _parser_main  # noqa: PLC0415
        returncode = _parser_main() or 0
    except SystemExit as exc:
        returncode = exc.code if isinstance(exc.code, int) else 0
    except Exception as exc:
        sys.stderr.write(f"parse_one error: {type(exc).__name__}: {exc}\n")
        returncode = 1
    finally:
        stdout_str = sys.stdout.getvalue()
        stderr_str = sys.stderr.getvalue()
        sys.stdout = _saved_stdout
        sys.stderr = _saved_stderr

    return (returncode, stdout_str, stderr_str)
