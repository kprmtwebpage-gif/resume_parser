"""
Pydantic schemas for Customer module API validation.
"""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel


# ── Contact Person ──────────────────────────────────────────────────────────

class ContactPersonCreate(BaseModel):
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    work_phone: Optional[str] = None
    mobile: Optional[str] = None


class ContactPersonRead(BaseModel):
    id: UUID
    customer_id: UUID
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    work_phone: Optional[str] = None
    mobile: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Customer Document ───────────────────────────────────────────────────────

class CustomerDocumentRead(BaseModel):
    id: UUID
    customer_id: UUID
    file_name: str
    file_size: Optional[int] = None
    file_url: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ── Activity Log ────────────────────────────────────────────────────────────

class ActivityLogRead(BaseModel):
    id: UUID
    customer_id: UUID
    action: str
    description: Optional[str] = None
    performed_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Customer ────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    customer_type: str = "Business"
    entity_type: str = "client"
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    country_code: Optional[str] = "+91"
    currency: Optional[str] = "INR"
    contact_persons: Optional[List[ContactPersonCreate]] = []


class CustomerUpdate(BaseModel):
    customer_type: Optional[str] = None
    entity_type: Optional[str] = None
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country_code: Optional[str] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerRead(BaseModel):
    id: UUID
    customer_id: str
    customer_type: str
    entity_type: str
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    country_code: Optional[str] = None
    currency: Optional[str] = None
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    contact_persons: List[ContactPersonRead] = []
    documents: List[CustomerDocumentRead] = []
    activities: List[ActivityLogRead] = []

    class Config:
        from_attributes = True


class CustomerListRead(BaseModel):
    """Lightweight version for list view (no nested relations)."""
    id: UUID
    customer_id: str
    customer_type: str
    entity_type: str
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    country_code: Optional[str] = None
    currency: Optional[str] = None
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    document_count: int = 0

    class Config:
        from_attributes = True
