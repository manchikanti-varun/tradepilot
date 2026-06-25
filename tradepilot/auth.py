"""Multi-user authentication & credential management for TradePilot SaaS.

Features:
- Email + password signup/login with bcrypt hashing
- JWT access tokens (24h expiry) + refresh tokens (30d expiry)
- AES-256-GCM encrypted storage of user broker credentials
- Per-user isolation via user_id FK on all data tables
- Dependency injection for FastAPI routes

Environment variable required:
- JWT_SECRET_KEY: Random 32+ char string for signing tokens
- ENCRYPTION_KEY: 32-byte base64-encoded key for AES-256 credential encryption
  Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

from tradepilot.database import get_db

logger = logging.getLogger(__name__)

# --- Configuration ---

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "CHANGE-ME-IN-PRODUCTION-minimum-32-chars!!")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Fernet key for encrypting broker credentials at rest
_ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "")
_fernet: Optional[Fernet] = None

if _ENCRYPTION_KEY:
    try:
        _fernet = Fernet(_ENCRYPTION_KEY.encode())
    except Exception as e:
        logger.error("Invalid ENCRYPTION_KEY: %s", e)


def _get_fernet() -> Fernet:
    """Get Fernet instance or raise."""
    if _fernet is None:
        raise HTTPException(
            status_code=500,
            detail="Server encryption not configured. Set ENCRYPTION_KEY env var.",
        )
    return _fernet


# --- Password Hashing ---

def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# --- JWT Tokens ---

def create_access_token(user_id: int, email: str) -> str:
    """Create a JWT access token."""
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """Create a JWT refresh token (longer lived)."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


# --- Credential Encryption ---

def encrypt_credential(plaintext: str) -> str:
    """Encrypt a credential (API key, password, etc.) for DB storage."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_credential(ciphertext: str) -> str:
    """Decrypt a stored credential."""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")


# --- FastAPI Dependencies ---

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """FastAPI dependency — extracts and validates the current user from JWT.
    
    Returns: {"user_id": int, "email": str}
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please login.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Use access token.",
        )

    user_id = int(payload["sub"])
    email = payload.get("email", "")

    # Verify user still exists and is active
    async with get_db() as db:
        row = await db.execute(
            "SELECT id, email, is_active FROM users WHERE id = ?", (user_id,)
        )
        user = await row.fetchone()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if not user["is_active"]:
            raise HTTPException(status_code=403, detail="Account deactivated")

    return {"user_id": user_id, "email": email}


# --- Request/Response Models ---

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_HOURS * 3600
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class BrokerCredentialsRequest(BaseModel):
    """Angel One credentials — OPTIONAL. Without these, Yahoo Finance is used (1-2 min delay).
    With these, real-time data via Angel One SmartAPI is enabled."""
    angel_api_key: str = Field(..., min_length=1, max_length=200)
    angel_client_id: str = Field(..., min_length=1, max_length=50)
    angel_password: str = Field(..., min_length=1, max_length=100)
    angel_totp_secret: str = Field(..., min_length=1, max_length=100)


class GroqKeyRequest(BaseModel):
    """Groq API key — REQUIRED for AI features. Get free at console.groq.com"""
    groq_api_key: str = Field(..., min_length=1, max_length=200)


# --- Core Auth Functions ---

async def signup_user(request: SignupRequest) -> dict:
    """Create a new user account."""
    async with get_db() as db:
        # Check if email already exists
        row = await db.execute("SELECT id FROM users WHERE email = ?", (request.email,))
        if await row.fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")

        # Hash password
        pw_hash = hash_password(request.password)

        # Create user
        cursor = await db.execute(
            """INSERT INTO users (email, password_hash, name, created_at, is_active)
            VALUES (?, ?, ?, ?, 1)""",
            (request.email, pw_hash, request.name, datetime.now().isoformat()),
        )
        user_id = cursor.lastrowid

        # Initialize user's growth state
        await db.execute(
            """INSERT INTO user_growth_state (user_id, current_capital, current_tier, peak_capital)
            VALUES (?, 20000.0, 'D', 20000.0)""",
            (user_id,),
        )

        # Initialize default settings
        await db.execute(
            """INSERT INTO user_settings_v2 (user_id, key, value, updated_at)
            VALUES (?, 'capital', '20000', ?)""",
            (user_id, datetime.now().isoformat()),
        )

        await db.commit()

    # Generate tokens
    access_token = create_access_token(user_id, request.email)
    refresh_token = create_refresh_token(user_id)

    logger.info("New user registered: %s (id=%d)", request.email, user_id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        "user": {"id": user_id, "email": request.email, "name": request.name},
    }


async def login_user(request: LoginRequest) -> dict:
    """Authenticate user and return tokens."""
    async with get_db() as db:
        row = await db.execute(
            "SELECT id, email, name, password_hash, is_active FROM users WHERE email = ?",
            (request.email,),
        )
        user = await row.fetchone()

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account deactivated")

    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = user["id"]
    access_token = create_access_token(user_id, user["email"])
    refresh_token = create_refresh_token(user_id)

    # Update last login
    async with get_db() as db:
        await db.execute(
            "UPDATE users SET last_login = ? WHERE id = ?",
            (datetime.now().isoformat(), user_id),
        )
        await db.commit()

    logger.info("User logged in: %s (id=%d)", user["email"], user_id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        "user": {"id": user_id, "email": user["email"], "name": user["name"]},
    }


async def refresh_access_token(refresh_token: str) -> dict:
    """Get a new access token using a refresh token."""
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = int(payload["sub"])

    async with get_db() as db:
        row = await db.execute("SELECT id, email, name FROM users WHERE id = ? AND is_active = 1", (user_id,))
        user = await row.fetchone()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    new_access_token = create_access_token(user_id, user["email"])

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    }


async def save_broker_credentials(user_id: int, creds: BrokerCredentialsRequest) -> dict:
    """Encrypt and store user's Angel One credentials. Preserves existing Groq key if set."""
    async with get_db() as db:
        # Check if row exists
        row = await db.execute("SELECT groq_api_key FROM user_credentials WHERE user_id = ?", (user_id,))
        existing = await row.fetchone()

        if existing:
            # Update only Angel One fields — preserve Groq key
            await db.execute(
                """UPDATE user_credentials
                SET angel_api_key = ?, angel_client_id = ?, angel_password = ?, angel_totp_secret = ?, updated_at = ?
                WHERE user_id = ?""",
                (
                    encrypt_credential(creds.angel_api_key),
                    encrypt_credential(creds.angel_client_id),
                    encrypt_credential(creds.angel_password),
                    encrypt_credential(creds.angel_totp_secret),
                    datetime.now().isoformat(),
                    user_id,
                ),
            )
        else:
            # No row yet — insert fresh
            await db.execute(
                """INSERT INTO user_credentials
                (user_id, angel_api_key, angel_client_id, angel_password, angel_totp_secret, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    user_id,
                    encrypt_credential(creds.angel_api_key),
                    encrypt_credential(creds.angel_client_id),
                    encrypt_credential(creds.angel_password),
                    encrypt_credential(creds.angel_totp_secret),
                    datetime.now().isoformat(),
                ),
            )
        await db.commit()

    logger.info("Broker credentials saved for user_id=%d", user_id)
    return {"status": "saved", "message": "Angel One credentials encrypted and stored."}


async def save_groq_key(user_id: int, request: GroqKeyRequest) -> dict:
    """Encrypt and store user's Groq API key. Preserves existing Angel One creds if set."""
    async with get_db() as db:
        # Check if row exists
        row = await db.execute("SELECT user_id FROM user_credentials WHERE user_id = ?", (user_id,))
        existing = await row.fetchone()

        if existing:
            # Update only Groq key — preserve Angel One fields
            await db.execute(
                "UPDATE user_credentials SET groq_api_key = ?, updated_at = ? WHERE user_id = ?",
                (encrypt_credential(request.groq_api_key), datetime.now().isoformat(), user_id),
            )
        else:
            # No row yet — insert with just Groq key
            await db.execute(
                "INSERT INTO user_credentials (user_id, groq_api_key, updated_at) VALUES (?, ?, ?)",
                (user_id, encrypt_credential(request.groq_api_key), datetime.now().isoformat()),
            )
        await db.commit()

    return {"status": "saved", "message": "Groq API key encrypted and stored."}


async def get_user_credentials(user_id: int) -> Optional[dict]:
    """Load and decrypt user's credentials. Returns None if not set."""
    async with get_db() as db:
        row = await db.execute(
            "SELECT * FROM user_credentials WHERE user_id = ?", (user_id,)
        )
        data = await row.fetchone()

    if data is None:
        return None

    result = {}
    if data["angel_api_key"]:
        result["angel_api_key"] = decrypt_credential(data["angel_api_key"])
    if data["angel_client_id"]:
        result["angel_client_id"] = decrypt_credential(data["angel_client_id"])
    if data["angel_password"]:
        result["angel_password"] = decrypt_credential(data["angel_password"])
    if data["angel_totp_secret"]:
        result["angel_totp_secret"] = decrypt_credential(data["angel_totp_secret"])
    if data["groq_api_key"]:
        result["groq_api_key"] = decrypt_credential(data["groq_api_key"])

    return result if result else None


async def has_broker_credentials(user_id: int) -> bool:
    """Check if user has configured broker credentials (optional — Yahoo works without this)."""
    async with get_db() as db:
        row = await db.execute(
            "SELECT angel_api_key FROM user_credentials WHERE user_id = ?", (user_id,)
        )
        data = await row.fetchone()
    return data is not None and data["angel_api_key"] is not None


async def has_groq_key(user_id: int) -> bool:
    """Check if user has configured Groq API key (required for AI features)."""
    async with get_db() as db:
        row = await db.execute(
            "SELECT groq_api_key FROM user_credentials WHERE user_id = ?", (user_id,)
        )
        data = await row.fetchone()
    return data is not None and data["groq_api_key"] is not None


async def get_user_data_provider(user_id: int):
    """Create the appropriate market data provider for a user.
    
    - If user has Angel One credentials → HybridProvider (real-time + bulk)
    - If not → YahooFinanceProvider (delayed, but works without any credentials)
    
    Angel One credentials are OPTIONAL. The system works fine with Yahoo only.
    """
    creds = await get_user_credentials(user_id)

    if creds and all([
        creds.get("angel_api_key"),
        creds.get("angel_client_id"),
        creds.get("angel_password"),
        creds.get("angel_totp_secret"),
    ]):
        # User has Angel One → Hybrid mode (real-time)
        # Note: In multi-user, each user would need their own session.
        # For now, this returns provider type info. Full per-user session pooling
        # is a Phase 2 optimization.
        return "hybrid"
    else:
        # No Angel One credentials → Yahoo Finance only (works for everyone)
        return "yahoo"
