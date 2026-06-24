"""Nightly GitHub backup — commits SQLite DB to a private repo.

Runs at 23:50 IST via APScheduler. Uses GitHub API (token from env var).
Token is NEVER logged, printed, or stored outside the environment variable.

Requires:
- GITHUB_BACKUP_REPO env var (e.g. "username/tradepilot-data")
- GITHUB_BACKUP_TOKEN env var (PAT with 'repo' scope)
"""

import asyncio
import base64
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import aiohttp

from tradepilot.config import DB_PATH, GITHUB_BACKUP_REPO, GITHUB_BACKUP_TOKEN


BACKUP_FILE_PATH = "backups/tradepilot.db"
GITHUB_API = "https://api.github.com"


async def backup_to_github() -> dict:
    """
    Commit the SQLite DB file to the configured private GitHub repo.
    Returns status dict for logging (never contains the token).
    """
    if not GITHUB_BACKUP_REPO or not GITHUB_BACKUP_TOKEN:
        return {
            "status": "skipped",
            "reason": "GITHUB_BACKUP_REPO or GITHUB_BACKUP_TOKEN not set",
            "timestamp": datetime.now().isoformat(),
        }

    if not DB_PATH.exists():
        return {
            "status": "skipped",
            "reason": "Database file does not exist yet",
            "timestamp": datetime.now().isoformat(),
        }

    try:
        # Read the DB file
        db_content = DB_PATH.read_bytes()
        content_b64 = base64.b64encode(db_content).decode("utf-8")

        headers = {
            "Authorization": f"Bearer {GITHUB_BACKUP_TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        url = f"{GITHUB_API}/repos/{GITHUB_BACKUP_REPO}/contents/{BACKUP_FILE_PATH}"

        async with aiohttp.ClientSession() as session:
            # Check if file already exists (need SHA for update)
            sha = await _get_existing_sha(session, url, headers)

            # Commit message
            now = datetime.now()
            message = f"Nightly backup {now.strftime('%Y-%m-%d %H:%M IST')}"

            payload = {
                "message": message,
                "content": content_b64,
                "branch": "main",
            }
            if sha:
                payload["sha"] = sha

            async with session.put(url, json=payload, headers=headers) as resp:
                if resp.status in (200, 201):
                    return {
                        "status": "success",
                        "message": message,
                        "size_bytes": len(db_content),
                        "timestamp": now.isoformat(),
                    }
                else:
                    error_text = await resp.text()
                    return {
                        "status": "failed",
                        "http_status": resp.status,
                        "error": error_text[:200],  # Truncate to avoid leaking anything
                        "timestamp": now.isoformat(),
                    }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e)[:200],
            "timestamp": datetime.now().isoformat(),
        }


async def _get_existing_sha(
    session: aiohttp.ClientSession,
    url: str,
    headers: dict,
) -> Optional[str]:
    """Get the SHA of the existing file (needed for updates)."""
    try:
        async with session.get(url, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("sha")
    except Exception:
        pass
    return None
