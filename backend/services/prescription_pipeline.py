from services.analysis_validation import safe_analysis
"""Authenticated prescription analysis with an independent, untrusted OCR path."""
import asyncio
import json
import os
from uuid import UUID
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, ConfigDict
from services.medicine_assistant import authenticated_user, rate_limit
from services import prescription_fallback as ocr

router = APIRouter()


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    prescription_id: UUID


async def owned_document(client, user_id, prescription_id):
    try:
        response = await client.get('/rest/v1/patient_prescriptions', params={
            'select': 'id,file_path,file_type', 'id': f'eq.{prescription_id}',
            'patient_id': f'eq.{user_id}', 'limit': '1',
        })
        response.raise_for_status()
        rows = response.json()
        if not rows:
            raise HTTPException(404, 'Prescription not found.')
        row = rows[0]
        path = row['file_path']
        if not isinstance(path, str) or not path.startswith(f'{user_id}/') or '\\' in path or '%' in path or any(part in ('.', '..', '') for part in path.split('/')):
            raise HTTPException(403, 'Prescription access denied.')
        # User JWT + private Storage policy; no signed/public URL or service role.
        async with client.stream('GET', '/storage/v1/object/authenticated/prescriptions/' + quote(path, safe='/')) as stream:
            stream.raise_for_status()
            data = bytearray()
            async for chunk in stream.aiter_bytes(chunk_size=64 * 1024):
                if len(data) + len(chunk) > ocr.MAX_BYTES:
                    raise HTTPException(413, 'File exceeds 10 MB.')
                data.extend(chunk)
        return bytes(data), row['file_type']
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, 'Unable to securely retrieve the prescription.') from None


async def gemini_analyze(data, mime):
    from services.prescription_analyzer import analyze_prescription
    return await analyze_prescription(data, mime)


def retryable(error):
    if isinstance(error, (TimeoutError, httpx.TimeoutException, json.JSONDecodeError)):
        return True
    return getattr(error, 'code', None) in (429, 500, 503, 504) or getattr(error, 'status_code', None) in (429, 500, 503, 504)


async def run_analysis(data, mime):
    try:
        images = await asyncio.to_thread(ocr.document_images, data, mime)
    except ocr.InvalidDocument as error:
        raise HTTPException(400, str(error)) from None
    except ocr.OCRUnavailable:
        raise HTTPException(503, 'Document validation is unavailable. Ask support to install the documented dependencies.') from None
    try:
        result = await asyncio.wait_for(gemini_analyze(data, mime), timeout=30)
        if not safe_analysis(result):
            raise json.JSONDecodeError('Invalid analysis', '', 0)
        result.update(extraction_source='gemini', raw_ocr_text=None,
                      requires_human_verification=True, analysis_status='analyzed',
                      uncertain_fields=result.get('uncertain_fields', []),
                      message='AI analysis completed. Verify details against the original prescription.')
        return result
    except Exception as error:
        if not retryable(error):
            raise HTTPException(503, 'Prescription analysis is unavailable. Please try again or contact support.') from None
    try:
        text = await asyncio.wait_for(asyncio.to_thread(ocr.extract_text, images), timeout=90)
    except ocr.OCRUnavailable:
        raise HTTPException(503, 'Gemini is unavailable and the free OCR fallback is not configured. Please review the original document manually.') from None
    except ocr.OCRBusy:
        raise HTTPException(503, 'OCR is busy. Please try again shortly.') from None
    except TimeoutError:
        raise HTTPException(504, 'OCR took too long. Review the original document or try again later.') from None
    except Exception:
        raise HTTPException(503, 'OCR could not read this document. Upload a clearer copy or request manual review.') from None
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(422, 'OCR found no readable text. Upload a clearer copy or ask a pharmacist to review it.')
    return {
        'extraction_source': 'paddleocr', 'raw_ocr_text': text,
        'requires_human_verification': True, 'analysis_status': 'pending_review',
        'uncertain_fields': ['medicine_name', 'strength', 'dosage', 'route', 'frequency', 'duration', 'instructions'],
        'medicines': [],
        'message': 'Gemini was unavailable. Free OCR extracted unverified text only. Ask a pharmacist or prescriber to confirm unclear details. This result cannot be used to create a schedule.',
    }


@router.post('/analyze-prescription')
async def analyze_endpoint(payload: AnalysisRequest, authorization: str | None = Header(default=None)):
    scheme, _, token = (authorization or '').partition(' ')
    if scheme.lower() != 'bearer' or not token or len(token) > 8192:
        raise HTTPException(401, 'Please sign in to analyze prescriptions.')
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_PUBLISHABLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    if not url.startswith('https://') or not key:
        raise HTTPException(503, 'Prescription authentication is not configured.')
    async with httpx.AsyncClient(base_url=url, timeout=15, headers={'apikey': key, 'Authorization': f'Bearer {token}'}) as client:
        user = await authenticated_user(client)
        rate_limit(user)
        data, mime = await owned_document(client, user, payload.prescription_id)
        result = await run_analysis(data, mime)
        if result['extraction_source'] == 'paddleocr':
            # Fail closed if the reviewed migration is not installed. Persist the
            # sticky database guard BEFORE exposing the result to the browser.
            try:
                saved = await client.patch('/rest/v1/patient_prescriptions', params={
                    'id': f'eq.{payload.prescription_id}', 'patient_id': f'eq.{user}',
                }, headers={'Prefer': 'return=representation'}, json={
                    'analysis_result': result, 'analysis_status': 'pending_review',
                    'ocr_review_required': True,
                })
                saved.raise_for_status()
                if not saved.json():
                    raise ValueError()
            except Exception:
                raise HTTPException(503, 'OCR completed but could not be saved safely. Ask support to check the OCR review migration.') from None
    return {'status': 'success', **{key: result[key] for key in ('message', 'extraction_source', 'raw_ocr_text', 'requires_human_verification', 'analysis_status', 'uncertain_fields')}, 'data': result}
