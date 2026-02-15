import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse

from models import User
from services.auth import get_current_user

router = APIRouter(prefix="/api", tags=["uploads"])

UPLOAD_DIR = "/app/data/uploads"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
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

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/api/uploads/{filename}"}


@router.get("/uploads/{filename}")
def serve_upload(filename: str):
    if ".." in filename:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")

    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Fichier non trouve")

    return FileResponse(filepath)
