from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.consents import router as consents_router
from app.api.v1.chat import router as chat_router
from app.api.v1.documents import router as documents_router
from app.api.v1.medications import router as medications_router
from app.api.v1.health_records import router as health_records_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.privacy import router as privacy_router
from app.api.v1.symptoms import router as symptoms_router
from app.api.v1.resources import router as resources_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.wellness import router as wellness_router

from app.api.v1.prescriptions import router as prescriptions_router
from app.api.v1.medicines import router as medicines_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.demo import router as demo_router
from app.api.v1.reports import router as reports_router
from app.api.v1.admin import router as admin_router
from app.api.v1.timeline import router as timeline_router
from app.api.v1.guardians import router as guardians_router

from app.api.v1.careconnect import router as careconnect_router

v1_router = APIRouter(prefix="/v1")

v1_router.include_router(auth_router)
v1_router.include_router(users_router)
v1_router.include_router(consents_router)
v1_router.include_router(chat_router)
v1_router.include_router(documents_router)
v1_router.include_router(reports_router)
v1_router.include_router(admin_router)
v1_router.include_router(timeline_router)
v1_router.include_router(guardians_router)
v1_router.include_router(prescriptions_router)
v1_router.include_router(medicines_router)
v1_router.include_router(medications_router)
v1_router.include_router(health_records_router)
v1_router.include_router(appointments_router)
v1_router.include_router(privacy_router)
v1_router.include_router(symptoms_router)
v1_router.include_router(resources_router)
v1_router.include_router(notifications_router)
v1_router.include_router(wellness_router)
v1_router.include_router(dashboard_router)
v1_router.include_router(demo_router)
v1_router.include_router(careconnect_router)

__all__ = ["v1_router"]

