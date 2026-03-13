"""
FastAPI router for /standalone-comments/ endpoints.
Handles adding and retrieving comments for candidates.
"""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db
from .models import StandaloneComment

router = APIRouter(prefix="/standalone-comments", tags=["Standalone Comments"])


# ----- Schemas ---------------------------------------------------------------

class CommentCreate(BaseModel):
    candidate_id: str
    comment_text: str


class CommentRead(BaseModel):
    id: int
    candidate_id: str
    comment_text: str
    created_at: datetime

    class Config:
        from_attributes = True


# ----- Endpoints -------------------------------------------------------------

@router.post(
    "/",
    response_model=CommentRead,
    status_code=status.HTTP_200_OK,
    summary="Add a standalone comment to a candidate",
)
async def create_comment(
    payload: CommentCreate,
    db: Session = Depends(get_db),
):
    if not payload.comment_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment text cannot be empty",
        )

    comment = StandaloneComment(
        candidate_id=payload.candidate_id,
        comment_text=payload.comment_text.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.get(
    "/{candidate_id}",
    response_model=List[CommentRead],
    summary="Get all standalone comments for a candidate",
)
async def get_comments(
    candidate_id: str,
    db: Session = Depends(get_db),
):
    comments = (
        db.query(StandaloneComment)
        .filter(StandaloneComment.candidate_id == candidate_id)
        .order_by(StandaloneComment.created_at.desc())
        .all()
    )
    return comments


@router.delete(
    "/{comment_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a standalone comment by ID",
)
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
):
    comment = db.query(StandaloneComment).filter(StandaloneComment.id == comment_id).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comment {comment_id} not found",
        )
    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted", "id": comment_id}
