from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import User, UserConsent
from app.schemas.all_schemas import ConsentUpdateRequest

router = APIRouter(prefix="/consents", tags=["Privacy Consents"])

@router.get("")
@router.get("/")
def get_consents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    consent = db.query(UserConsent).filter(UserConsent.user_id == current_user.id).first()
    if not consent:
        consent = UserConsent(user_id=current_user.id)
        db.add(consent)
        db.commit()
        db.refresh(consent)
    return {"consent": consent}

@router.put("")
@router.put("/")
def update_consents(req: ConsentUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    consent = db.query(UserConsent).filter(UserConsent.user_id == current_user.id).first()
    if not consent:
        consent = UserConsent(user_id=current_user.id)
        db.add(consent)

    if req.dataProcessingAccepted is not None: consent.data_processing_accepted = req.dataProcessingAccepted
    if req.guardianSharingAccepted is not None: consent.guardian_sharing_accepted = req.guardianSharingAccepted
    if req.emergencyAlertsAccepted is not None: consent.emergency_alerts_accepted = req.emergencyAlertsAccepted
    if req.teleconsultAccepted is not None: consent.teleconsult_accepted = req.teleconsultAccepted

    db.commit()
    db.refresh(consent)
    return {"success": True, "consent": consent}
