import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from models import User
from services.auth import get_current_user

router = APIRouter(prefix="/api", tags=["uploads"])

UPLOAD_DIR = Path("/app/data/uploads")
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
EXTENSION_MEDIA_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/upload")
async def upload_file(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Extension non autorisee. Formats acceptes: jpg, jpeg, png, gif, webp")

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 5 MB)")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = (UPLOAD_DIR / filename).resolve()
    if not filepath.is_relative_to(UPLOAD_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")

    with open(filepath, "wb") as f:
        f.write(contents)

    try:
        Image.open(filepath).verify()
    except Exception:
        os.remove(filepath)
        raise HTTPException(status_code=400, detail="Le fichier n'est pas une image valide")

    return {"url": f"/api/uploads/{filename}"}


@router.get("/uploads/{filename}")
def serve_upload(filename: str):
    filepath = (UPLOAD_DIR / filename).resolve()
    if not filepath.is_relative_to(UPLOAD_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")

    if not filepath.is_file():
        raise HTTPException(status_code=404, detail="Fichier non trouve")

    ext = filepath.suffix.lstrip(".").lower()
    media_type = EXTENSION_MEDIA_TYPES.get(ext)
    if not media_type:
        raise HTTPException(status_code=400, detail="Type de fichier non supporte")

    return FileResponse(
        filepath,
        media_type=media_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f"inline; filename=\"{filepath.name}\"",
        },
    )
