"""
Authentication utilities for Radar.

This module provides JWT token management and encryption utilities.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64

from app.core.config import settings
from app.services.monitoring_service import MonitoringService

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Token encryption
# In production, this key should be stored securely (e.g., AWS KMS, HashiCorp Vault)
def get_encryption_key() -> bytes:
    """Get or generate encryption key from settings."""
    # Use the SECRET_KEY to derive an encryption key
    # In production, use a dedicated encryption key
    key = base64.urlsafe_b64encode(settings.SECRET_KEY.encode()[:32].ljust(32, b'0'))
    return key

fernet = Fernet(get_encryption_key())


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Data to encode in the token
        expires_delta: Token expiration time
        
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode a JWT access token.
    
    Args:
        token: JWT token to decode
        
    Returns:
        Decoded token data or None if invalid
    """
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return None


def encrypt_token(token: str) -> str:
    """
    Encrypt a sensitive token (e.g., GitHub/Slack tokens).
    
    Args:
        token: Token to encrypt
        
    Returns:
        Encrypted token
    """
    try:
        encrypted = fernet.encrypt(token.encode())
        return encrypted.decode()
    except Exception as e:
        logger.error(f"Token encryption error: {e}")
        raise


def decrypt_token(encrypted_token: str) -> Optional[str]:
    """
    Decrypt a sensitive token.
    
    Args:
        encrypted_token: Encrypted token
        
    Returns:
        Decrypted token or None if decryption fails
    """
    try:
        if not encrypted_token:
            return None
        
        decrypted = fernet.decrypt(encrypted_token.encode())
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Token decryption error: {e}")
        return None


def hash_password(password: str) -> str:
    """
    Hash a password.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password
        
    Returns:
        True if password matches
    """
    return pwd_context.verify(plain_password, hashed_password)


class TokenManager:
    """Manager for handling token operations."""
    
    @staticmethod
    def create_user_token(user_id: str, additional_claims: Optional[Dict[str, Any]] = None) -> str:
        """
        Create a JWT token for a user.
        
        Args:
            user_id: User ID
            additional_claims: Additional claims to include in token
            
        Returns:
            JWT token
        """
        data = {
            "sub": user_id,
            "type": "user_access",
            "iat": datetime.utcnow()
        }
        
        if additional_claims:
            data.update(additional_claims)
        
        return create_access_token(data)
    
    @staticmethod
    def validate_user_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Validate a user JWT token.
        
        Args:
            token: JWT token
            
        Returns:
            Token payload if valid, None otherwise
        """
        payload = decode_access_token(token)
        user_id = None
        
        try:
            if not payload:
                MonitoringService.track_authentication(
                    user_id="unknown",
                    auth_method="jwt_validation",
                    success=False,
                    error="Failed to decode token"
                )
                return None
            
            user_id = payload.get("sub")
            
            # Check token type
            if payload.get("type") != "user_access":
                logger.error("Invalid token type")
                MonitoringService.track_authentication(
                    user_id=user_id or "unknown",
                    auth_method="jwt_validation",
                    success=False,
                    error="Invalid token type"
                )
                return None
            
            # Check if token has required fields
            if "sub" not in payload:
                logger.error("Token missing subject")
                MonitoringService.track_authentication(
                    user_id="unknown",
                    auth_method="jwt_validation",
                    success=False,
                    error="Token missing subject"
                )
                return None
            
            # Track successful token validation
            MonitoringService.track_authentication(
                user_id=user_id,
                auth_method="jwt_validation",
                success=True
            )
            
            return payload
            
        except Exception as e:
            MonitoringService.track_authentication(
                user_id=user_id or "unknown",
                auth_method="jwt_validation",
                success=False,
                error=str(e)
            )
            raise
    
    @staticmethod
    def encrypt_external_token(token: str) -> str:
        """
        Encrypt an external service token (GitHub, Slack).
        
        Args:
            token: External service token
            
        Returns:
            Encrypted token
        """
        return encrypt_token(token)
    
    @staticmethod
    def decrypt_external_token(encrypted_token: str) -> Optional[str]:
        """
        Decrypt an external service token.
        
        Args:
            encrypted_token: Encrypted token
            
        Returns:
            Decrypted token or None
        """
        return decrypt_token(encrypted_token)