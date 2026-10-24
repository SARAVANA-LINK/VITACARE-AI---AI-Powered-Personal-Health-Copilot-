from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.all_models import User
import time

security_scheme = HTTPBearer(auto_error=False)

# In-memory rate limiter per IP / User
RATE_LIMIT_BUCKETS = {}

def check_rate_limit(request: Request, max_requests: int = 120, window_seconds: int = 60):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    if client_ip not in RATE_LIMIT_BUCKETS:
        RATE_LIMIT_BUCKETS[client_ip] = []
        
    # Purge old timestamps
    RATE_LIMIT_BUCKETS[client_ip] = [
        ts for ts in RATE_LIMIT_BUCKETS[client_ip] if now - ts < window_seconds
    ]
    
    if len(RATE_LIMIT_BUCKETS[client_ip]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before sending more requests."
        )
    
    RATE_LIMIT_BUCKETS[client_ip].append(now)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = payload.get("userId") or payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account does not exist or has been deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
