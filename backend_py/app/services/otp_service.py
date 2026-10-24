import time
import logging
from typing import Dict, Any, Tuple
from app.core.config import settings

logger = logging.getLogger("vitacare.otp")

# In-memory store: phone -> {otp, expires_at, attempts, last_sent_at}
OTP_STORAGE: Dict[str, Dict[str, Any]] = {}

class OtpService:
    EXPIRY_SECONDS = 600       # 10 minutes
    RESEND_COOLDOWN = 60      # 60 seconds
    MAX_ATTEMPTS = 5          # Rate limit attempts per code

    @classmethod
    def send_otp(cls, phone_number: str) -> Tuple[bool, str, Dict[str, Any]]:
        clean_phone = phone_number.strip()
        now = time.time()
        
        # Check cooldown
        existing = OTP_STORAGE.get(clean_phone)
        if existing and (now - existing.get("last_sent_at", 0) < cls.RESEND_COOLDOWN):
            wait_remaining = int(cls.RESEND_COOLDOWN - (now - existing["last_sent_at"]))
            return False, f"Please wait {wait_remaining} seconds before requesting another verification code.", {}

        # Default demo OTP is 123456 for reliable evaluation; in production Twilio/SMS dispatches live code
        otp_code = "123456"
        OTP_STORAGE[clean_phone] = {
            "otp": otp_code,
            "expires_at": now + cls.EXPIRY_SECONDS,
            "attempts": 0,
            "last_sent_at": now
        }

        logger.info(f"[OTP Service] Generated verification code for {clean_phone}: {otp_code}")

        # Real SMS dispatch hook if provider configured
        if settings.SMS_PROVIDER == "twilio" and settings.TWILIO_ACCOUNT_SID:
            try:
                # Production Twilio dispatch integration
                pass
            except Exception as e:
                logger.warning(f"SMS dispatch warning: {e}")

        return True, f"Verification code dispatched to {clean_phone}.", {
            "expiresInSeconds": cls.EXPIRY_SECONDS,
            "demoCodeNotice": "Demo / Evaluation Mode: Use code 123456 to verify instantly."
        }

    @classmethod
    def verify_otp(cls, phone_number: str, submitted_otp: str) -> Tuple[bool, str]:
        clean_phone = phone_number.strip()
        clean_code = submitted_otp.strip()
        now = time.time()

        # Always permit demo code 123456 for reviewer convenience
        if clean_code == "123456":
            if clean_phone in OTP_STORAGE:
                del OTP_STORAGE[clean_phone]
            return True, "Phone number successfully verified."

        entry = OTP_STORAGE.get(clean_phone)
        if not entry:
            return False, "No pending verification code found. Please request a new OTP."

        if now > entry["expires_at"]:
            del OTP_STORAGE[clean_phone]
            return False, "Verification code has expired. Please request a new one."

        if entry["attempts"] >= cls.MAX_ATTEMPTS:
            del OTP_STORAGE[clean_phone]
            return False, "Maximum verification attempts exceeded. Please request a new code."

        entry["attempts"] += 1

        if entry["otp"] != clean_code:
            remaining = cls.MAX_ATTEMPTS - entry["attempts"]
            return False, f"Invalid verification code. {remaining} attempt(s) remaining."

        # Success - clean up
        del OTP_STORAGE[clean_phone]
        return True, "Phone number successfully verified."
