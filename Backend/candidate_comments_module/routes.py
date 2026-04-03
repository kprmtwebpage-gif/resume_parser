"""
FastAPI router for /api/candidate-comments/ endpoints.

Usage in main.py (when ready):
    from candidate_comments_module import candidate_comments_router
    app.include_router(candidate_comments_router)
"""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .schemas import CommentCreate, CommentRead
from . import service

router = APIRouter(prefix="/api/candidate-comments", tags=["Candidate Comments"])


# ----- Endpoints -------------------------------------------------------------

@router.post(
    "/",
    response_model=CommentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to a candidate",
)
async def create_candidate_comment(
    payload: CommentCreate,
    db: Session = Depends(get_db),
):
    return service.create_comment(db, payload)


@router.get(
    "/{candidate_id}",
    response_model=List[CommentRead],
    summary="Get all comments for a candidate",
)
async def get_candidate_comments(
    candidate_id: int,
    db: Session = Depends(get_db),
):
    return service.get_comments_by_candidate(db, candidate_id)


@router.delete(
    "/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a comment by ID",
)
async def delete_candidate_comment(
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    deleted = service.delete_comment(db, comment_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comment {comment_id} not found",
        )
    return None
