import os
import uuid
import shutil
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
import logging

logger = logging.getLogger("vitacare.storage")

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf"
}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 # 15 MB

class StorageService:
    @staticmethod
    def ensure_upload_dir() -> str:
        upload_path = os.path.abspath(settings.LOCAL_STORAGE_DIR)
        os.makedirs(upload_path, exist_ok=True)
        return upload_path

    @classmethod
    async def save_uploaded_file(cls, file: UploadFile, subfolder: str = "documents") -> Tuple[str, str, int]:
        """
        Validates and securely stores an uploaded file.
        Returns: (file_url, file_path, file_size)
        """
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type ({file.content_type}). Allowed: JPG, PNG, WEBP, PDF."
            )

        ext = ALLOWED_MIME_TYPES[file.content_type]
        unique_filename = f"{uuid.uuid4()}{ext}"

        base_dir = cls.ensure_upload_dir()
        target_dir = os.path.join(base_dir, subfolder)
        os.makedirs(target_dir, exist_ok=True)

        destination_path = os.path.join(target_dir, unique_filename)

        total_bytes = 0
        try:
            with open(destination_path, "wb") as buffer:
                while chunk := await file.read(1024 * 1024): # 1MB chunks
                    total_bytes += len(chunk)
                    if total_bytes > MAX_FILE_SIZE_BYTES:
                        os.remove(destination_path)
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="File size exceeds the 15 MB clinical document limit."
                        )
                    buffer.write(chunk)
        except Exception as e:
            if os.path.exists(destination_path):
                os.remove(destination_path)
            raise e

        # Local or S3 URL mapping
        relative_url = f"/uploads/{subfolder}/{unique_filename}"
        return relative_url, destination_path, total_bytes

    @classmethod
    def save_base64_file(cls, base64_str: str, subfolder: str = "prescriptions", filename_prefix: str = "rx-cam") -> Tuple[str, str, int]:
        """
        Saves a base64 encoded image (e.g. from camera capture) to disk.
        Returns: (file_url, file_path, file_size)
        """
        import base64
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]

        data = base64.b64decode(base64_str)
        unique_filename = f"{filename_prefix}-{uuid.uuid4()}.jpg"

        base_dir = cls.ensure_upload_dir()
        target_dir = os.path.join(base_dir, subfolder)
        os.makedirs(target_dir, exist_ok=True)

        destination_path = os.path.join(target_dir, unique_filename)
        with open(destination_path, "wb") as f:
            f.write(data)

        relative_url = f"/uploads/{subfolder}/{unique_filename}"
        return relative_url, destination_path, len(data)

    @classmethod
    def save_text_file(cls, text: str, subfolder: str = "prescriptions", filename_prefix: str = "rx-sample") -> Tuple[str, str, int]:
        """
        Saves raw prescription or report text to disk.
        Returns: (file_url, file_path, file_size)
        """
        unique_filename = f"{filename_prefix}-{uuid.uuid4()}.txt"
        base_dir = cls.ensure_upload_dir()
        target_dir = os.path.join(base_dir, subfolder)
        os.makedirs(target_dir, exist_ok=True)

        destination_path = os.path.join(target_dir, unique_filename)
        with open(destination_path, "w", encoding="utf-8") as f:
            f.write(text)

        relative_url = f"/uploads/{subfolder}/{unique_filename}"
        return relative_url, destination_path, len(text.encode("utf-8"))

    @classmethod
    def delete_file(cls, file_path: str) -> bool:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                return True
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {e}")
        return False

