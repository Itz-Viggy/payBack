# pdf_converter.py
# Converts uploaded PDFs/images into a format suitable for Gemini input.
# Handles text extraction (PyPDF2) or page images (pdf2image) for scanned PDFs;
# image uploads are passed through as single image bytes.

from dataclasses import dataclass
from io import BytesIO
import re

from PyPDF2 import PdfReader

# MIME detection: python-magic (or python-magic-bin on Windows)
try:
    import magic
except ImportError:
    magic = None

# PDF page rendering (requires poppler); only used when text extraction yields no usable text
try:
    from pdf2image import convert_from_bytes as pdf2image_convert_from_bytes
except ImportError:
    pdf2image_convert_from_bytes = None

from PIL import Image


# ---------------------------------------------------------------------------
# Result type and exceptions
# ---------------------------------------------------------------------------

@dataclass
class ConversionResult:
    """Result of converting an uploaded bill file to Gemini input.

    - Text path: text is non-empty, use for extraction prompt {{bill_text}}.
    - Image path: text is None/empty, images is non-empty list of image bytes for Gemini vision.
    """
    text: str | None
    images: list[bytes] | None
    image_mime: str | None = None  # e.g. "image/png", for Gemini SDK if needed


class UnsupportedFileTypeError(Exception):
    """Raised when the file MIME type is not PDF or a supported image type."""
    pass


class ConversionError(Exception):
    """Raised when the file is corrupt or conversion fails."""
    pass


# Supported MIME types
PDF_MIME = "application/pdf"
IMAGE_MIMES = {"image/png", "image/jpeg", "image/jpg"}
SUPPORTED_MIMES = {PDF_MIME} | IMAGE_MIMES

# Minimum non-whitespace character count to consider PDF text "usable"
MIN_TEXT_LENGTH = 50


def _detect_mime(content: bytes, filename: str, content_type: str | None) -> str:
    """Detect MIME from bytes (magic), with fallback to content_type or filename extension."""
    if magic:
        try:
            detected = magic.from_buffer(content, mime=True)
            if detected:
                return detected
        except Exception:
            pass
    if content_type and content_type.strip():
        # Normalize e.g. "image/jpg" -> treat as jpeg
        ct = content_type.strip().lower().split(";")[0].strip()
        if ct == "image/jpg":
            ct = "image/jpeg"
        if ct in SUPPORTED_MIMES:
            return ct
    # Fallback: extension
    ext = (filename or "").lower().split(".")[-1] if "." in (filename or "") else ""
    mime_by_ext = {
        "pdf": PDF_MIME,
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }
    return mime_by_ext.get(ext, "")


def _pdf_to_text(content: bytes) -> str:
    """Extract text from PDF using PyPDF2. Returns normalized string (may be empty)."""
    reader = PdfReader(BytesIO(content))
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    raw = " ".join(parts)
    normalized = re.sub(r"\s+", " ", raw).strip()
    return normalized


def _pdf_to_images(content: bytes) -> list[bytes]:
    """Render each PDF page to PNG bytes. Requires poppler (pdf2image)."""
    if not pdf2image_convert_from_bytes:
        raise ConversionError("pdf2image is not available; install it and poppler for scanned PDF support")
    pil_images = pdf2image_convert_from_bytes(content, fmt="png")
    result = []
    for img in pil_images:
        buf = BytesIO()
        img.save(buf, format="PNG")
        result.append(buf.getvalue())
    return result


def _image_to_bytes(content: bytes, mime: str) -> list[bytes]:
    """Validate and optionally normalize image; return single-element list of image bytes."""
    try:
        img = Image.open(BytesIO(content))
        img.load()
    except Exception as e:
        raise ConversionError(f"Invalid or corrupt image: {e}") from e
    buf = BytesIO()
    # Prefer PNG for consistency; JPEG for photos is fine as-is
    if mime == "image/png":
        img.save(buf, format="PNG")
    else:
        img.save(buf, format="JPEG", quality=95)
    return [buf.getvalue()]


def convert_to_bill_input(
    content: bytes,
    filename: str,
    content_type: str | None = None,
) -> ConversionResult:
    """Convert uploaded file content to either text or images for Gemini.

    - PDF: try text extraction first; if text is below MIN_TEXT_LENGTH, render pages to images.
    - Image (PNG/JPEG): return single image as list of bytes.
    - Empty content returns ConversionResult(text=None, images=None); route may treat as 400.
    - Unsupported type or corrupt file raises.

    Args:
        content: Raw file bytes.
        filename: Original filename (used for MIME fallback).
        content_type: Optional MIME from UploadFile.content_type.

    Returns:
        ConversionResult with either text or images set (and the other None/empty).

    Raises:
        UnsupportedFileTypeError: MIME not PDF or supported image.
        ConversionError: Corrupt file or conversion failure.
    """
    if not content or len(content) == 0:
        return ConversionResult(text=None, images=None)

    mime = _detect_mime(content, filename, content_type)
    if not mime or mime not in SUPPORTED_MIMES:
        raise UnsupportedFileTypeError(
            f"Unsupported file type (detected: {mime or 'unknown'}). Use PDF or PNG/JPEG."
        )

    if mime == PDF_MIME:
        try:
            text = _pdf_to_text(content)
        except Exception as e:
            raise ConversionError(f"Failed to read PDF: {e}") from e
        if text and len(text) >= MIN_TEXT_LENGTH:
            return ConversionResult(text=text, images=None)
        # Scanned or image-only PDF: render to images
        try:
            images = _pdf_to_images(content)
        except ConversionError:
            raise
        except Exception as e:
            raise ConversionError(f"Failed to render PDF to images: {e}") from e
        if not images:
            return ConversionResult(text=None, images=None)
        return ConversionResult(text=None, images=images, image_mime="image/png")

    # Image branch
    if mime in IMAGE_MIMES:
        normalized_mime = "image/jpeg" if mime == "image/jpg" else mime
        images = _image_to_bytes(content, normalized_mime)
        return ConversionResult(
            text=None,
            images=images,
            image_mime=normalized_mime,
        )

    raise UnsupportedFileTypeError(f"Unsupported file type: {mime}")
