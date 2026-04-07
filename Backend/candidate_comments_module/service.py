"""Service layer for candidate_comments_module."""

import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import CandidateComment
from .schemas import CommentCreate


def create_comment(db: Session, payload: CommentCreate) -> CandidateComment:
    comment = CandidateComment(
        candidate_id=payload.candidate_id,
        comment_text=payload.comment_text.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_comments_by_candidate(db: Session, candidate_id: int) -> List[CandidateComment]:
    return (
        db.query(CandidateComment)
        .filter(CandidateComment.candidate_id == candidate_id)
        .order_by(CandidateComment.created_at.desc())
        .all()
    )


def delete_comment(db: Session, comment_id: uuid.UUID) -> bool:
    comment = db.query(CandidateComment).filter(CandidateComment.id == comment_id).first()
    if not comment:
        return False
    db.delete(comment)
    db.commit()
    return True
