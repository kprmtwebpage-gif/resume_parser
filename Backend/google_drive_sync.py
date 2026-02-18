"""Google Drive (Shared Drive) folder sync.

This module is intentionally optional. It is only used when RESUME_INPUT_MODE=gdrive.

Auth model: Installed App OAuth (user browser) using google-auth-oauthlib.
Token is cached locally so subsequent runs are non-interactive.

Supports Shared Drives via:
- includeItemsFromAllDrives=True
- supportsAllDrives=True

Env vars:
- GDRIVE_FOLDER_ID: required (the folder in Drive containing resumes)
- GDRIVE_CREDENTIALS_JSON: required (OAuth client secrets json)
- GDRIVE_TOKEN_JSON: optional (default: .gdrive_token.json in repo root)

Optional:
- GDRIVE_PAGE_SIZE: default 200
- GDRIVE_QUERY_EXTRA: appended to query

Typical usage:
    from google_drive_sync import sync_drive_folder
    sync_drive_folder(folder_id, download_dir)
"""

from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class DriveFile:
    id: str
    name: str
    md5Checksum: str | None
    mimeType: str | None
    modifiedTime: str | None


def _safe_filename(name: str) -> str:
    name = (name or "").strip()
    name = re.sub(r"[<>:\\/*?\"|]", "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name[:180] if len(name) > 180 else name


def _sha256_bytes(b: bytes) -> str:
    h = hashlib.sha256()
    h.update(b)
    return h.hexdigest()


def _build_drive_service(credentials_json: Path, token_json: Path):
    # Lazy imports so the repo works without Drive deps.
    from googleapiclient.discovery import build  # type: ignore
    from google.auth.transport.requests import Request  # type: ignore

    scopes = ["https://www.googleapis.com/auth/drive.readonly"]

    # Support service account JSON (useful for non-interactive runs) as well
    try:
        import json
        from google.oauth2 import service_account  # type: ignore
        creds_data = json.loads(credentials_json.read_text(encoding="utf-8")) if credentials_json.exists() else None
        if creds_data and creds_data.get("type") == "service_account":
            creds = service_account.Credentials.from_service_account_file(
                str(credentials_json), scopes=scopes
            )
            return build("drive", "v3", credentials=creds, cache_discovery=False)
    except Exception:
        # Fall back to installed-app flow below
        pass

    # Installed app flow (user OAuth) fallback
    from google.oauth2.credentials import Credentials  # type: ignore
    from google_auth_oauthlib.flow import InstalledAppFlow  # type: ignore

    creds = None
    if token_json.exists():
        creds = Credentials.from_authorized_user_file(str(token_json), scopes=scopes)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(credentials_json), scopes=scopes)
            creds = flow.run_local_server(port=0)
        token_json.write_text(creds.to_json(), encoding="utf-8")

    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _iter_drive_files(service, *, folder_id: str, page_size: int, query_extra: str = "") -> Iterable[DriveFile]:
    q = f"'{folder_id}' in parents and trashed=false"
    if query_extra:
        q = f"({q}) and ({query_extra})"

    page_token = None
    while True:
        resp = (
            service.files()
            .list(
                q=q,
                fields="nextPageToken, files(id,name,md5Checksum,mimeType,modifiedTime)",
                pageSize=page_size,
                pageToken=page_token,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            )
            .execute()
        )

        for f in resp.get("files", []) or []:
            yield DriveFile(
                id=str(f.get("id") or ""),
                name=str(f.get("name") or ""),
                md5Checksum=f.get("md5Checksum"),
                mimeType=f.get("mimeType"),
                modifiedTime=f.get("modifiedTime"),
            )

        page_token = resp.get("nextPageToken")
        if not page_token:
            break


def _download_file_bytes(service, file_id: str) -> bytes:
    from googleapiclient.http import MediaIoBaseDownload  # type: ignore

    import io

    fh = io.BytesIO()
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        _status, done = downloader.next_chunk()
    return fh.getvalue()


def sync_drive_folder(
    *,
    folder_id: str,
    download_dir: Path,
    credentials_json: Path,
    token_json: Path,
    allowed_exts: set[str] | None = None,
) -> tuple[int, int]:
    """Sync a Google Drive folder into download_dir.

    Returns: (scanned, downloaded)
    """

    if not folder_id:
        raise ValueError("folder_id is required")

    download_dir.mkdir(parents=True, exist_ok=True)

    service = _build_drive_service(credentials_json, token_json)

    page_size = int(os.getenv("GDRIVE_PAGE_SIZE", "200") or "200")
    query_extra = (os.getenv("GDRIVE_QUERY_EXTRA", "") or "").strip()

    scanned = 0
    downloaded = 0

    for f in _iter_drive_files(service, folder_id=folder_id, page_size=page_size, query_extra=query_extra):
        scanned += 1
        name = _safe_filename(f.name)
        if not name:
            continue

        suffix = Path(name).suffix.lower()
        if allowed_exts is not None and suffix not in allowed_exts:
            continue

        # We store as: <name> (or <name>__<id> when collision)
        out_path = download_dir / name
        if out_path.exists():
            # If we have md5 and it matches current file hash, skip.
            if f.md5Checksum:
                try:
                    current = out_path.read_bytes()
                    if hashlib.md5(current).hexdigest() == f.md5Checksum:  # nosec - checksum compare
                        continue
                except Exception:
                    pass
            # Fall back to drive id disambiguation to avoid overwriting.
            out_path = download_dir / f"{Path(name).stem}__{f.id}{suffix}"
            if out_path.exists():
                continue

        data = _download_file_bytes(service, f.id)
        if not data:
            continue
        out_path.write_bytes(data)
        downloaded += 1

    return scanned, downloaded
