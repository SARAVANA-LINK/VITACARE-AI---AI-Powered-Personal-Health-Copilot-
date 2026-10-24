"""
VitaCare AI — Base Repository Pattern
Provides standard database session handling, transaction boundary control,
and explicit user ownership isolation enforcement.
"""

from typing import TypeVar, Generic, Type, Optional, List, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.database import Base

T = TypeVar("T", bound=Base)

class BaseRepository(Generic[T]):
    """
    Abstract base repository providing typed CRUD operations,
    transaction commits/rollbacks, and strict tenant/user isolation.
    """
    def __init__(self, model_class: Type[T], db: Session):
        self.model_class = model_class
        self.db = db

    def get_by_id(self, record_id: str) -> Optional[T]:
        """Fetch a single record by primary key."""
        return self.db.query(self.model_class).filter(self.model_class.id == record_id).first()

    def get_by_id_for_user(self, record_id: str, user_id: str) -> Optional[T]:
        """
        Enforce strict tenant isolation: Fetch record by ID ensuring it belongs to user_id.
        Prevents IDOR (Insecure Direct Object Reference) vulnerabilities.
        """
        if not hasattr(self.model_class, "user_id"):
            raise ValueError(f"Model {self.model_class.__name__} does not have user_id tenant column")
        return self.db.query(self.model_class).filter(
            self.model_class.id == record_id,
            self.model_class.user_id == user_id
        ).first()

    def list_for_user(self, user_id: str, limit: int = 100, offset: int = 0) -> List[T]:
        """List records belonging strictly to user_id."""
        if not hasattr(self.model_class, "user_id"):
            raise ValueError(f"Model {self.model_class.__name__} does not have user_id tenant column")
        return self.db.query(self.model_class).filter(
            self.model_class.user_id == user_id
        ).offset(offset).limit(limit).all()

    def create(self, instance: T) -> T:
        """Persist a new entity within an atomic transaction."""
        try:
            self.db.add(instance)
            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception:
            self.db.rollback()
            raise

    def update(self, instance: T) -> T:
        """Update an existing entity."""
        try:
            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception:
            self.db.rollback()
            raise

    def delete(self, instance: T) -> bool:
        """Delete an entity within an atomic transaction."""
        try:
            self.db.delete(instance)
            self.db.commit()
            return True
        except Exception:
            self.db.rollback()
            raise
