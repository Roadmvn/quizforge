"""
QR code generation service.

Generates a QR code PNG as base64 string for embedding in the frontend.
The QR code points to the participant join URL with the session code.
"""

import base64
import io

import qrcode


def generate_qr_base64(join_url: str) -> str:
    """Generate a QR code PNG and return as base64-encoded data URI."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(join_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode()
    return f"data:image/png;base64,{b64}"
