"""Service layer for candidate comments CRUD."""

from typing import List

from sqlalchemy.orm import Session

from .models import CandidateComment
from .schemas import CommentCreate


def create_comment(db: Session, payload: CommentCreate) -> CandidateComment:
    comment = CandidateComment(
        candidate_id=payload.candidate_id,
        comment_text=payload.comment_text,
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


def delete_comment(db: Session, comment_id) -> bool:
    comment = db.query(CandidateComment).filter(CandidateComment.id == comment_id).first()
    if not comment:
        return False
    db.delete(comment)
    db.commit()
    return True
