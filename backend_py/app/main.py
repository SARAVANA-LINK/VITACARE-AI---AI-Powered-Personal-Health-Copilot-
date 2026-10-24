import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import logging

from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.services.admin_setup_service import init_admin_and_settings
from app.api.v1 import v1_router

# Individual routers for /api legacy compatibility
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.consents import router as consents_router
from app.api.v1.chat import router as chat_router
from app.api.v1.documents import router as documents_router
from app.api.v1.reports import router as reports_router
from app.api.v1.admin import router as admin_router
from app.api.v1.timeline import router as timeline_router
from app.api.v1.guardians import router as guardians_router
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
from app.api.v1.careconnect import router as careconnect_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vitacare.main")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing VitaCare AI Database & Services...")
    init_db()
    db = SessionLocal()
    try:
        init_admin_and_settings(db)
        logger.info("Admin account, system configuration, and CMS prototype verified.")
    except Exception as e:
        logger.warning(f"Admin & settings setup note: {e}")
    finally:
        db.close()
    logger.info(f"VitaCare AI FastAPI Backend is ready. Docs: http://localhost:8000/docs")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade AI Healthcare Backend powered by FastAPI, PostgreSQL, and Clinical Safety Pipelines.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploaded files
upload_dir = os.path.abspath(settings.LOCAL_STORAGE_DIR)
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

# Mount Versioned API: /api/v1/*
app.include_router(v1_router, prefix="/api")

# Mount Legacy Compatibility Routes: /api/* (Matches frontend API calls)
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(consents_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(chat_router, prefix="/api/ai") # Legacy alias for /api/ai/chat and /api/ai/threads
app.include_router(documents_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(timeline_router, prefix="/api")
app.include_router(guardians_router, prefix="/api")
app.include_router(prescriptions_router, prefix="/api")
app.include_router(medicines_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(demo_router, prefix="/api")
app.include_router(medications_router, prefix="/api")
app.include_router(health_records_router, prefix="/api")
app.include_router(health_records_router, prefix="/api/health") # Alias for /api/health/vitals, /api/health/trends
app.include_router(appointments_router, prefix="/api")
app.include_router(privacy_router, prefix="/api")
app.include_router(symptoms_router, prefix="/api")
app.include_router(resources_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(wellness_router, prefix="/api")
app.include_router(careconnect_router, prefix="/api")

@app.get("/settings/public", tags=["Public Settings"])
@app.get("/api/settings/public", tags=["Public Settings"])
def get_public_settings():
    from app.models.all_models import AppSetting
    db = SessionLocal()
    try:
        setting = db.query(AppSetting).filter(AppSetting.id == "global_settings").first()
        return {
            "settings": {
                "websiteName": setting.website_name if setting else "VitaCare AI",
                "logoUrl": setting.logo_url if setting else "",
                "themePrimaryColor": setting.theme_primary_color if setting else "#0284c7",
                "supportPhone": setting.support_phone if setting else "+1-800-VITA-CARE",
                "supportEmail": setting.support_email if setting else "support@vitacare.ai",
                "defaultLanguage": setting.default_language if setting else "en",
                "allowNewRegistrations": setting.allow_new_registrations if setting else True,
                "maintenanceMode": setting.maintenance_mode if setting else False
            }
        }
    finally:
        db.close()

@app.get("/health", tags=["Health Check"])
@app.get("/api/health", tags=["Health Check"])
@app.get("/api/v1/health", tags=["Health Check"])
def health_check():
    return {
        "status": "healthy",
        "service": "VitaCare AI FastAPI Backend",
        "version": settings.VERSION,
        "database": "connected",
        "aiProvider": settings.AI_PROVIDER,
        "smsProvider": settings.SMS_PROVIDER,
        "safetyPipeline": "active"
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "An internal server error occurred.", "detail": str(exc)}
    )

