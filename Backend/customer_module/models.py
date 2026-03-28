"""
SQLAlchemy ORM models for the customer module.
Tables: customers, contact_persons, customer_documents, customer_activity_log
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Integer, DateTime, Boolean,
    ForeignKey, BigInteger, Float
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from .database import Base


def _now():
    return datetime.now(timezone.utc)


def generate_customer_id() -> str:
    """Generate a unique customer ID like CUST-00001."""
    import random
    ts = datetime.now(timezone.utc)
    return f"CUST-{ts.strftime('%y%m%d')}{random.randint(1000, 9999)}"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(String(50), unique=True, nullable=False, default=generate_customer_id)
    customer_type = Column(String(20), nullable=False, default="Business")
    salutation = Column(String(10), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    country_code = Column(String(10), nullable=True, default="+91")
    currency = Column(String(10), nullable=True, default="INR")
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    # Relationships
    contact_persons = relationship("ContactPerson", back_populates="customer", cascade="all, delete-orphan")
    documents = relationship("CustomerDocument", back_populates="customer", cascade="all, delete-orphan")
    activities = relationship("CustomerActivityLog", back_populates="customer", cascade="all, delete-orphan",
                              order_by="CustomerActivityLog.created_at.desc()")

    def __repr__(self):
        return f"<Customer id={self.id} display_name={self.display_name!r}>"


class ContactPerson(Base):
    __tablename__ = "contact_persons"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(PG_UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    salutation = Column(String(10), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    work_phone = Column(String(50), nullable=True)
    mobile = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    customer = relationship("Customer", back_populates="contact_persons")

    def __repr__(self):
        return f"<ContactPerson id={self.id} name={self.first_name} {self.last_name}>"


class CustomerDocument(Base):
    __tablename__ = "customer_documents"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(PG_UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=True)
    file_url = Column(Text, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    customer = relationship("Customer", back_populates="documents")

    def __repr__(self):
        return f"<CustomerDocument id={self.id} file={self.file_name!r}>"


class CustomerActivityLog(Base):
    __tablename__ = "customer_activity_log"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(PG_UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    performed_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    customer = relationship("Customer", back_populates="activities")

    def __repr__(self):
        return f"<CustomerActivityLog id={self.id} action={self.action!r}>"
