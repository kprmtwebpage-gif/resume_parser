"""
Symmetric encryption helpers for email credentials.
Uses Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography library.

The encryption key is derived from JWT_SECRET via PBKDF2 so we don't
need yet another env variable.
"""

import base64
import os

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from dotenv import load_dotenv

load_dotenv()

_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-32-chars-minimum!")
_SALT = b"email-settings-encryption-salt"  # Static salt — key is per-deployment


def _derive_key() -> bytes:
    """Derive a 32-byte Fernet key from the JWT secret."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=480_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(_SECRET.encode("utf-8")))


_fernet = Fernet(_derive_key())


def encrypt_password(plaintext: str) -> str:
    """Encrypt a password string. Returns a base64-encoded token."""
    return _fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_password(ciphertext: str) -> str:
    """Decrypt an encrypted password token back to plaintext."""
    return _fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
