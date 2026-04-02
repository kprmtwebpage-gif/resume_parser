"""
FastAPI router — full CRUD for customers, contact persons, documents, activity.

Endpoints:
    POST   /customers                         → create customer
    GET    /customers                         → list customers (with search/filter/sort)
    GET    /customers/{id}                    → get one customer (full detail)
    PUT    /customers/{id}                    → update customer
    DELETE /customers/{id}                    → delete customer
    POST   /customers/{id}/clone              → clone customer

    POST   /customers/{id}/contact-persons    → add contact person
    PUT    /customers/{id}/contact-persons/{cp_id} → update contact person
    DELETE /customers/{id}/contact-persons/{cp_id} → delete contact person

    POST   /customers/{id}/documents          → upload documents
    GET    /customers/{id}/documents/{doc_id}/download → download document
    DELETE /customers/{id}/documents/{doc_id}  → delete document

    GET    /customers/{id}/activities          → get activity log
"""

from __future__ import annotations

import os
import uuid
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, desc, asc
from fastapi.responses import FileResponse

from pydantic import BaseModel

from .database import get_db
from .models import Customer, ContactPerson, CustomerDocument, CustomerActivityLog
from .schemas import (
    CustomerCreate, CustomerRead, CustomerUpdate, CustomerListRead,
    ContactPersonCreate, ContactPersonRead,
    CustomerDocumentRead, ActivityLogRead,
)


class _StatusPayload(BaseModel):
    status: str  # "active" | "inactive"

# Absolute base path
_BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = _BACKEND_DIR / "uploads" / "customers"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILES_PER_CUSTOMER = 5
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _get_username_from_request(request=None):
    """Extract username from JWT token in request headers."""
    if request is None:
        return "System"
    try:
        from auth import decode_token
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token)
            return payload.get("sub", "Unknown")
    except Exception:
        pass
    return "Unknown"


def _log_activity(db: Session, customer_id, action: str, description: str, performed_by: str):
    """Create an activity log entry."""
    log = CustomerActivityLog(
        customer_id=customer_id,
        action=action,
        description=description,
        performed_by=performed_by,
    )
    db.add(log)


# ── CREATE ──────────────────────────────────────────────────────────────────

@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, request: Request, db: Session = Depends(get_db)):
    username = _get_username_from_request(request)

    customer = Customer(
        customer_type=payload.customer_type,
        entity_type=payload.entity_type,
        salutation=payload.salutation,
        first_name=payload.first_name,
        last_name=payload.last_name,
        company_name=payload.company_name,
        display_name=payload.display_name,
        email=payload.email,
        phone=payload.phone,
        country_code=payload.country_code,
        currency=payload.currency or "INR",
        created_by=username,
    )
    db.add(customer)
    db.flush()

    # Add contact persons
    if payload.contact_persons:
        for cp in payload.contact_persons:
            contact = ContactPerson(
                customer_id=customer.id,
                salutation=cp.salutation,
                first_name=cp.first_name,
                last_name=cp.last_name,
                email=cp.email,
                work_phone=cp.work_phone,
                mobile=cp.mobile,
            )
            db.add(contact)

    _log_activity(db, customer.id, "Customer created",
                  f"Customer '{customer.display_name}' has been created", username)
    db.commit()
    db.refresh(customer)
    return customer


# ── LIST ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[CustomerListRead])
def list_customers(
    search: Optional[str] = Query(None, description="Search in name, company, email, phone"),
    filter_status: Optional[str] = Query(None, alias="status", description="all, active, inactive"),
    entity_type: Optional[str] = Query(None, description="client | vendor | own_company | candidate"),
    sort_by: Optional[str] = Query("created_at", description="name, created_at, company_name"),
    sort_order: Optional[str] = Query("desc", description="asc or desc"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Customer)

    # Filter by entity_type
    if entity_type:
        query = query.filter(Customer.entity_type == entity_type.lower())

    # Filter by status
    if filter_status == "active":
        query = query.filter(Customer.is_active == True)
    elif filter_status == "inactive":
        query = query.filter(Customer.is_active == False)

    # Search
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Customer.display_name.ilike(like),
                Customer.first_name.ilike(like),
                Customer.last_name.ilike(like),
                Customer.company_name.ilike(like),
                Customer.email.ilike(like),
                Customer.phone.ilike(like),
            )
        )

    # Sort
    if sort_by == "name":
        col = Customer.display_name
    elif sort_by == "company_name":
        col = Customer.company_name
    else:
        col = Customer.created_at

    if sort_order == "asc":
        query = query.order_by(asc(col))
    else:
        query = query.order_by(desc(col))

    total = query.count()
    customers = query.offset(offset).limit(limit).all()

    result = []
    for c in customers:
        doc_count = db.query(func.count(CustomerDocument.id)).filter(
            CustomerDocument.customer_id == c.id
        ).scalar() or 0
        item = CustomerListRead.model_validate(c)
        item.document_count = doc_count
        result.append(item)

    return result


# ── GET ONE ─────────────────────────────────────────────────────────────────

@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    """Get customer by UUID or customer_id string."""
    customer = _find_customer(customer_id, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


def _find_customer(customer_id: str, db: Session) -> Optional[Customer]:
    """Find customer by UUID or by custom customer_id."""
    # Try UUID first
    try:
        uid = uuid.UUID(customer_id)
        c = db.query(Customer).options(
            joinedload(Customer.contact_persons),
            joinedload(Customer.documents),
            joinedload(Customer.activities),
        ).filter(Customer.id == uid).first()
        if c:
            return c
    except (ValueError, AttributeError):
        pass
    # Try custom customer_id
    return db.query(Customer).options(
        joinedload(Customer.contact_persons),
        joinedload(Customer.documents),
        joinedload(Customer.activities),
    ).filter(Customer.customer_id == customer_id).first()


# ── UPDATE ──────────────────────────────────────────────────────────────────

@router.put("/{customer_id}", response_model=CustomerRead)
def update_customer(customer_id: str, payload: CustomerUpdate, request: Request, db: Session = Depends(get_db)):
    customer = _find_customer(customer_id, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    username = _get_username_from_request(request)
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(customer, key, val)

    _log_activity(db, customer.id, "Customer updated",
                  f"Customer '{customer.display_name}' has been updated", username)
    db.commit()
    db.refresh(customer)
    return customer


# ── DELETE ──────────────────────────────────────────────────────────────────

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: str, request: Request, db: Session = Depends(get_db)):
    customer = _find_customer(customer_id, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    username = _get_username_from_request(request)

    # Delete uploaded files
    cust_dir = UPLOAD_DIR / str(customer.id)
    if cust_dir.exists():
        shutil.rmtree(cust_dir)

    db.delete(customer)
    db.commit()
    return None


# ── CLONE ───────────────────────────────────────────────────────────────────

@router.post("/{customer_id}/clone", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def clone_customer(customer_id: str, request: Request, db: Session = Depends(get_db)):
    original = _find_customer(customer_id, db)
    if not original:
        raise HTTPException(status_code=404, detail="Customer not found")

    username = _get_username_from_request(request)

    clone = Customer(
        customer_type=original.customer_type,
        salutation=original.salutation,
        first_name=original.first_name,
        last_name=original.last_name,
        company_name=original.company_name,
        display_name=f"{original.display_name} (Copy)",
        email=original.email,
        phone=original.phone,
        country_code=original.country_code,
        currency=original.currency,
        created_by=username,
    )
    db.add(clone)
    db.flush()

    # Clone contact persons
    for cp in original.contact_persons:
        new_cp = ContactPerson(
            customer_id=clone.id,
            salutation=cp.salutation,
            first_name=cp.first_name,
            last_name=cp.last_name,
            email=cp.email,
            work_phone=cp.work_phone,
            mobile=cp.mobile,
        )
        db.add(new_cp)

    _log_activity(db, clone.id, "Customer cloned",
                  f"Cloned from '{original.display_name}'", username)
    db.commit()
    db.refresh(clone)
    return clone


# ── CONTACT PERSONS ─────────────────────────────────────────────────────────

@router.post("/{customer_id}/contact-persons", response_model=ContactPersonRead, status_code=status.HTTP_201_CREATED)
def add_contact_person(customer_id: str, payload: ContactPersonCreate, request: Request, db: Session = Depends(get_db)):
    customer = _find_customer(customer_id, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    username = _get_username_from_request(request)
    cp = ContactPerson(
        customer_id=customer.id,
        salutation=payload.salutation,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        work_phone=payload.work_phone,
        mobile=payload.mobile,
    )
    db.add(cp)
    _log_activity(db, customer.id, "Contact person added",
                  f"Contact person {payload.first_name or ''} {payload.last_name or ''} has been added", username)
    db.commit()
    db.refresh(cp)
    return cp


@router.put("/{customer_id}/contact-persons/{cp_id}", response_model=ContactPersonRead)
def update_contact_person(customer_id: str, cp_id: str, payload: ContactPersonCreate, db: Session = Depends(get_db)):
    try:
        cp_uuid = uuid.UUID(cp_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contact person ID")
    cp = db.query(ContactPerson).filter(ContactPerson.id == cp_uuid).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Contact person not found")

    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(cp, key, val)
    db.commit()
    db.refresh(cp)
    return cp


@router.delete("/{customer_id}/contact-persons/{cp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact_person(customer_id: str, cp_id: str, db: Session = Depends(get_db)):
    try:
        cp_uuid = uuid.UUID(cp_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid contact person ID")
    cp = db.query(ContactPerson).filter(ContactPerson.id == cp_uuid).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Contact person not found")
    db.delete(cp)
    db.commit()
    return None


# ── DOCUMENTS ───────────────────────────────────────────────────────────────

@router.post("/{customer_id}/documents", response_model=List[CustomerDocumentRead])
async def upload_documents(customer_id: str, files: List[UploadFile] = File(...), request: Request = None, db: Session = Depends(get_db)):
    customer = _find_customer(customer_id, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    username = _get_username_from_request(request)

    # Check existing doc count
    existing = db.query(func.count(CustomerDocument.id)).filter(
        CustomerDocument.customer_id == customer.id
    ).scalar() or 0

    if existing + len(files) > MAX_FILES_PER_CUSTOMER:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_FILES_PER_CUSTOMER} files allowed. Currently {existing} uploaded."
        )

    cust_dir = UPLOAD_DIR / str(customer.id)
    cust_dir.mkdir(parents=True, exist_ok=True)

    uploaded = []
    for f in files:
        contents = await f.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File '{f.filename}' exceeds 10MB limit")

        safe_name = f"{uuid.uuid4().hex}_{f.filename}"
        file_path = cust_dir / safe_name
        with open(file_path, "wb") as out:
            out.write(contents)

        doc = CustomerDocument(
            customer_id=customer.id,
            file_name=f.filename,
            file_size=len(contents),
            file_url=f"/api/customers/{customer.id}/documents/{safe_name}/download",
        )
        db.add(doc)
        uploaded.append(doc)

    _log_activity(db, customer.id, "File uploaded",
                  f"{len(files)} file(s) uploaded", username)
    db.commit()
    for doc in uploaded:
        db.refresh(doc)
    return uploaded


@router.get("/{customer_id}/documents/{file_name}/download")
def download_document(customer_id: str, file_name: str):
    try:
        cust_uuid = uuid.UUID(customer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid customer ID")

    file_path = UPLOAD_DIR / str(cust_uuid) / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(file_path),
        filename=file_name.split("_", 1)[1] if "_" in file_name else file_name,
        media_type="application/octet-stream",
    )


@router.delete("/{customer_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(customer_id: str, doc_id: str, db: Session = Depends(get_db)):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = db.query(CustomerDocument).filter(CustomerDocument.id == doc_uuid).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete physical file
    url_parts = doc.file_url.split("/")
    if len(url_parts) > 0:
        actual_filename = url_parts[-2] if url_parts[-1] == "download" else url_parts[-1]
        file_path = UPLOAD_DIR / customer_id / actual_filename
        if file_path.exists():
            file_path.unlink()

    db.delete(doc)
    db.commit()
    return None


# ── ACTIVITIES ──────────────────────────────────────────────────────────────

@router.get("/{customer_id}/activities", response_model=List[ActivityLogRead])
def get_activities(customer_id: str, db: Session = Depends(get_db)):
    customer = _find_customer(customer_id, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer.activities


# ── STATUS TOGGLE ────────────────────────────────────────────────────────────

@router.patch("/{customer_id}/status", response_model=CustomerRead)
def update_customer_status(customer_id: str, payload: _StatusPayload, request: Request, db: Session = Depends(get_db)):
    """Toggle active / inactive status for a customer or vendor."""
    customer = _find_customer(customer_id, db)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    username = _get_username_from_request(request)
    is_active = payload.status.lower() in ("active", "true", "1")
    customer.is_active = is_active

    action_label = "Customer activated" if is_active else "Customer deactivated"
    _log_activity(
        db, customer.id, action_label,
        f"Customer '{customer.display_name}' has been {'activated' if is_active else 'deactivated'}",
        username,
    )
    db.commit()
    db.refresh(customer)
    return customer
