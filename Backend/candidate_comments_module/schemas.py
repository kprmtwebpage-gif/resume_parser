"""Pydantic schemas for the candidate_comments_module."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class CommentCreate(BaseModel):
    candidate_id: int
    comment_text: str


class CommentRead(BaseModel):
    id: uuid.UUID
    candidate_id: int
    comment_text: str
    created_at: datetime

    class Config:
        from_attributes = True
