"""
VitaCare AI — Chat Conversation & Message Repository
Enforces tenant isolation, message safety tagging, and retention policies.
"""

import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.all_models import ChatConversation, ChatMessage

class ChatRepository(BaseRepository[ChatConversation]):
    def __init__(self, db: Session):
        super().__init__(ChatConversation, db)

    def create_conversation(self, user_id: str, title: str = "Health Consultation", language: str = "en") -> ChatConversation:
        """Create a new user-isolated consultation session."""
        conv = ChatConversation(
            user_id=user_id,
            title=title,
            language=language
        )
        self.db.add(conv)
        self.db.commit()
        self.db.refresh(conv)
        return conv

    def add_message(
        self, conversation_id: str, user_id: str, sender_role: str,
        message_text: str, model_identifier: Optional[str] = None,
        response_metadata: str = "{}", safety_status: str = "safe",
        language: str = "en"
    ) -> ChatMessage:
        """Add a clinical message to a conversation after validating user ownership."""
        conv = self.get_by_id_for_user(conversation_id, user_id)
        if not conv:
            raise ValueError("Conversation not found or access denied")

        msg = ChatMessage(
            conversation_id=conversation_id,
            user_id=user_id,
            sender_role=sender_role,
            message_text=message_text,
            model_identifier=model_identifier,
            response_metadata=response_metadata,
            safety_status=safety_status,
            language=language,
            created_at=datetime.datetime.utcnow()
        )
        conv.updated_at = datetime.datetime.utcnow()
        self.db.add(msg)
        self.db.commit()
        self.db.refresh(msg)
        return msg

    def get_messages(self, conversation_id: str, user_id: str, limit: int = 100) -> List[ChatMessage]:
        """Fetch chronological messages for a conversation, strictly validating user ownership."""
        conv = self.get_by_id_for_user(conversation_id, user_id)
        if not conv:
            raise ValueError("Conversation not found or unauthorized")

        return self.db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation_id
        ).order_by(ChatMessage.created_at.asc()).limit(limit).all()

    def list_active_conversations(self, user_id: str, limit: int = 50) -> List[ChatConversation]:
        """List active conversations for user excluding soft-deleted ones."""
        return self.db.query(ChatConversation).filter(
            ChatConversation.user_id == user_id,
            ChatConversation.deleted_at.is_(None)
        ).order_by(ChatConversation.updated_at.desc()).limit(limit).all()

    def soft_delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        """Soft delete a conversation ensuring patient ownership."""
        conv = self.get_by_id_for_user(conversation_id, user_id)
        if conv:
            conv.deleted_at = datetime.datetime.utcnow()
            self.db.commit()
            return True
        return False

    def enforce_retention_policy(self, user_id: str, retention_days: int = 90) -> int:
        """Hard delete chat conversations older than the configurable retention window."""
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=retention_days)
        expired = self.db.query(ChatConversation).filter(
            ChatConversation.user_id == user_id,
            ChatConversation.updated_at < cutoff
        ).all()

        count = len(expired)
        for conv in expired:
            self.db.delete(conv)
        self.db.commit()
        return count
