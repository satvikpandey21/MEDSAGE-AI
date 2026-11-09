"""CPU-only OCR. No network, model downloads, medication parsing or logging."""
import io
import os
import threading
import warnings
from contextlib import closing
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024
MAX_PAGES = 5
MAX_PIXELS = 12_000_000
MAX_TOTAL_PIXELS = 30_000_000
MAX_TEXT = 100_000
_lock = threading.Lock()
_engine = None


class OCRUnavailable(Exception):
    pass


class OCRBusy(Exception):
    pass


class InvalidDocument(Exception):
    pass


def document_images(data, mime):
    """Decode before either provider; reject malformed/oversized content."""
    if mime not in ('image/jpeg', 'image/png', 'application/pdf'):
        raise InvalidDocument('Only JPG, PNG and PDF files are supported.')
    if not data or len(data) > MAX_BYTES:
        raise InvalidDocument('The document must be nonempty and at most 10 MB.')
    try:
        from PIL import Image, ImageOps
    except ImportError:
        raise OCRUnavailable('Document validation dependencies are unavailable.') from None
    try:
        if mime != 'application/pdf':
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as image:
                    expected = 'PNG' if mime == 'image/png' else 'JPEG'
                    if image.format != expected or getattr(image, 'n_frames', 1) != 1:
                        raise InvalidDocument('File contents do not match a supported still image.')
                    if image.width * image.height > MAX_PIXELS:
                        raise InvalidDocument('Image exceeds the 12 megapixel limit.')
                    image.load()
                    return [ImageOps.exif_transpose(image).convert('RGB')]
        if not data.startswith(b'%PDF-'):
            raise InvalidDocument('Invalid PDF content.')
        try:
            import pypdfium2 as pdfium
        except ImportError:
            raise OCRUnavailable('PDF validation dependencies are unavailable.') from None
        with closing(pdfium.PdfDocument(data)) as pdf:
            if not 1 <= len(pdf) <= MAX_PAGES:
                raise InvalidDocument('PDF must contain 1 to 5 pages.')
            # Check all dimensions BEFORE rendering any page at 150 DPI.
            total = 0
            for index in range(len(pdf)):
                with closing(pdf[index]) as page:
                    width, height = page.get_size()
                    pixels = (int(width * 150 / 72) + 1) * (int(height * 150 / 72) + 1)
                    total += pixels
                    if width <= 0 or height <= 0 or pixels > MAX_PIXELS or total > MAX_TOTAL_PIXELS:
                        raise InvalidDocument('PDF exceeds page or total pixel limits.')
            images = []
            for index in range(len(pdf)):
                with closing(pdf[index]) as page:
                    bitmap = page.render(scale=150 / 72)
                    try:
                        images.append(bitmap.to_pil().convert('RGB'))
                    finally:
                        bitmap.close()
            return images
    except (InvalidDocument, OCRUnavailable):
        raise
    except Exception:
        raise InvalidDocument('Unreadable, encrypted or unsupported document. Upload a clear JPG, PNG or PDF.') from None


def get_engine():
    global _engine
    if _engine is not None:
        return _engine
    if os.getenv('PADDLE_OCR_ENABLED', 'false').lower() != 'true':
        raise OCRUnavailable()
    # Local directories are mandatory: Paddle must never auto-download weights.
    paths = [os.getenv('PADDLE_OCR_DET_MODEL_DIR', ''), os.getenv('PADDLE_OCR_REC_MODEL_DIR', '')]
    if not all(p and Path(p).is_dir() and (Path(p) / 'inference.yml').is_file() for p in paths):
        raise OCRUnavailable()
    try:
        # Local weights are provisioned explicitly; skip PaddleX host probes.
        os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'
        from paddleocr import PaddleOCR
        _engine = PaddleOCR(
            device='cpu', ocr_version='PP-OCRv5',
            text_detection_model_name='PP-OCRv5_server_det',
            text_recognition_model_name='PP-OCRv5_server_rec',
            text_detection_model_dir=paths[0], text_recognition_model_dir=paths[1],
            use_doc_orientation_classify=False, use_doc_unwarping=False,
            use_textline_orientation=False, cpu_threads=2,
        )
    except Exception:
        raise OCRUnavailable() from None
    return _engine


def extract_text(images):
    # One native inference at a time; reject excess work instead of queuing it.
    if not _lock.acquire(blocking=False):
        raise OCRBusy()
    try:
        engine = get_engine()
        try:
            import numpy as np
        except ImportError:
            raise OCRUnavailable() from None
        pages = []
        for number, image in enumerate(images, 1):
            lines = []
            for result in engine.predict(np.asarray(image)):
                # PaddleOCR 3.x OCRResult is a mapping; do not print/save it.
                lines.extend(text.strip() for text in result['rec_texts'] if isinstance(text, str) and text.strip())
            if lines:
                pages.append(f'[Page {number}]\n' + '\n'.join(lines))
            if sum(map(len, pages)) + 2 * len(pages) > MAX_TEXT:
                raise ValueError('OCR output limit exceeded')
        return '\n\n'.join(pages)
    finally:
        _lock.release()
