import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    PROJECT_NAME: str = "VitaCare AI Health Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False
    
    # Security & Tokens
    SECRET_KEY: str = "vitacare_production_master_secret_key_2026_super_secure_clinical_jwt"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database (PostgreSQL with SQLite local dev fallback)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./vitacare.db")
    
    # Redis Cache & Background Tasks
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Object Storage (S3 / MinIO / Local Fallback)
    STORAGE_TYPE: str = "local" # "local" or "s3"
    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET_NAME: str = "vitacare-medical-docs"
    LOCAL_STORAGE_DIR: str = "./uploads"
    
    # AI Clinical Assistant Provider
    AI_PROVIDER: str = "gemini" # "gemini", "openai", "anthropic", "local_rag"
    AI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    OPENAI_API_KEY: str = ""
    
    # SMS / OTP Provider
    SMS_PROVIDER: str = "mock" # "mock", "twilio", "fast2sms"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_PHONE: str = ""
    
    # Email Service
    EMAIL_PROVIDER: str = "console" # "console", "smtp", "sendgrid"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 120

settings = Settings()
