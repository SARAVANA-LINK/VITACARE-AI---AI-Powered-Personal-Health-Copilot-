"""
VitaCare AI — User, Profile, Auth Session, and Privacy Consent Repository
"""

import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.all_models import (
    User, UserProfile, AuthenticationSession, PrivacyConsent,
    DataDeletionRequest, AuditEvent
)

class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> Optional[User]:
        """Find active user by normalized email."""
        return self.db.query(User).filter(
            User.email == email.lower().strip(),
            User.deleted_at.is_(None)
        ).first()

    def get_by_phone(self, phone_number: str) -> Optional[User]:
        """Find active user by normalized E.164 phone number."""
        clean_phone = phone_number.strip().replace(" ", "").replace("-", "")
        return self.db.query(User).filter(
            User.phone_number == clean_phone,
            User.deleted_at.is_(None)
        ).first()

    def get_profile(self, user_id: str) -> Optional[UserProfile]:
        """Retrieve user clinical profile."""
        return self.db.query(UserProfile).filter(UserProfile.user_id == user_id).first()

    def create_or_update_profile(self, user_id: str, profile_data: Dict[str, Any]) -> UserProfile:
        """Upsert user profile within a single transaction."""
        profile = self.get_profile(user_id)
        if not profile:
            profile = UserProfile(user_id=user_id, **profile_data)
            self.db.add(profile)
        else:
            for k, v in profile_data.items():
                if hasattr(profile, k) and v is not None:
                    setattr(profile, k, v)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def create_auth_session(
        self, user_id: str, token_hash: str, expires_at: datetime.datetime,
        device_metadata: str = "{}", ip_address: Optional[str] = None
    ) -> AuthenticationSession:
        """Create a new hashed authentication session."""
        session = AuthenticationSession(
            user_id=user_id,
            session_or_token_hash=token_hash,
            expires_at=expires_at,
            device_metadata=device_metadata,
            ip_address=ip_address
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def revoke_auth_session(self, token_hash: str) -> bool:
        """Revoke a session by token hash."""
        session = self.db.query(AuthenticationSession).filter(
            AuthenticationSession.session_or_token_hash == token_hash,
            AuthenticationSession.revoked_at.is_(None)
        ).first()
        if session:
            session.revoked_at = datetime.datetime.utcnow()
            self.db.commit()
            return True
        return False

    def record_privacy_consent(
        self, user_id: str, consent_type: str, purpose_and_scope: str,
        policy_version: str = "v1.0", granted: bool = True
    ) -> PrivacyConsent:
        """Record or update a granular privacy consent decision."""
        consent = self.db.query(PrivacyConsent).filter(
            PrivacyConsent.user_id == user_id,
            PrivacyConsent.consent_type == consent_type,
            PrivacyConsent.policy_version == policy_version
        ).first()

        now = datetime.datetime.utcnow()
        if not consent:
            consent = PrivacyConsent(
                user_id=user_id,
                consent_type=consent_type,
                policy_version=policy_version,
                granted=granted,
                granted_at=now,
                purpose_and_scope=purpose_and_scope
            )
            self.db.add(consent)
        else:
            consent.granted = granted
            if granted:
                consent.granted_at = now
                consent.withdrawn_at = None
            else:
                consent.withdrawn_at = now
            consent.purpose_and_scope = purpose_and_scope

        self.db.commit()
        self.db.refresh(consent)
        return consent

    def log_audit_event(
        self, action_type: str, target_type: str, actor_user_id: Optional[str] = None,
        target_id: Optional[str] = None, minimal_metadata: str = "{}", ip_address: Optional[str] = None
    ) -> AuditEvent:
        """Log a non-PHI audit event for security and compliance."""
        event = AuditEvent(
            actor_user_id=actor_user_id,
            action_type=action_type,
            target_type=target_type,
            target_id=target_id,
            minimal_metadata=minimal_metadata,
            ip_address=ip_address
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def request_data_deletion(self, user_id: str) -> DataDeletionRequest:
        """Initiate GDPR / DPDP statutory data erasure request."""
        req = DataDeletionRequest(user_id=user_id, status="pending")
        self.db.add(req)
        self.db.commit()
        self.db.refresh(req)
        return req
