"""Pydantic schemas for candidate comments."""

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

    model_config = {"from_attributes": True}
