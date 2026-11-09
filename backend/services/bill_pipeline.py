from services.analysis_validation import safe_analysis
"""Authenticated, bounded bill analysis; no public URLs or service-role access."""
import asyncio
import os
import time
from collections import deque
from urllib.parse import quote
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, ValidationError
from services.medicine_assistant import authenticated_user
from services import prescription_fallback as documents

router = APIRouter()


class BillRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    bill_id: UUID


class WindowLimit:
    def __init__(self, count, seconds, max_keys=10000):
        self.count, self.seconds, self.max_keys = count, seconds, max_keys
        self.buckets = {}

    def check(self, key):
        now = time.monotonic()
        for expired in [k for k, q in self.buckets.items() if not q or q[-1] <= now-self.seconds]:
            del self.buckets[expired]
        q = self.buckets.get(key)
        if q is None:
            if len(self.buckets) >= self.max_keys:
                raise HTTPException(429, 'Bill service request capacity reached.', headers={'Retry-After':'60'})
            q = self.buckets[key] = deque()
        while q and q[0] <= now-self.seconds:
            q.popleft()
        if len(q) >= self.count:
            raise HTTPException(429, 'Too many bill requests. Please try later.', headers={'Retry-After':str(self.seconds)})
        q.append(now)


_attempts = WindowLimit(60, 60)
_users_minute = WindowLimit(5, 60)
_users_hour = WindowLimit(20, 3600)
_global = WindowLimit(60, 3600, 1)
_active = set()


async def owned_bill(client, user, bill_id):
    try:
        response = await client.get('/rest/v1/patient_bills', params={
            'select':'id,file_path,file_type', 'id':f'eq.{bill_id}',
            'patient_id':f'eq.{user}', 'limit':'1',
        })
        response.raise_for_status()
        rows = response.json()
        if not rows:
            raise HTTPException(404, 'Bill not found.')
        path = rows[0]['file_path']
        if not isinstance(path,str) or not path.startswith(user+'/') or '\\' in path or '%' in path or any(p in ('','.','..') for p in path.split('/')):
            raise HTTPException(403, 'Bill access denied.')
        mime = rows[0]['file_type']
        if mime not in ('image/png','image/jpeg','application/pdf'):
            raise HTTPException(400, 'Only JPG, PNG and PDF bills are supported.')
        async with client.stream('GET','/storage/v1/object/authenticated/pharmacy-bills/'+quote(path,safe='/')) as stream:
            stream.raise_for_status()
            payload = bytearray()
            async for chunk in stream.aiter_bytes(chunk_size=64*1024):
                if len(payload)+len(chunk)>documents.MAX_BYTES:
                    raise HTTPException(413,'Bill exceeds 10 MB.')
                payload.extend(chunk)
        return bytes(payload),mime
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503,'Unable to securely retrieve the bill.') from None


async def analyze(data,mime):
    from services.bill_analyzer import analyze_pharmacy_bill
    return await analyze_pharmacy_bill(data,mime)


@router.post('/analyze-bill')
async def analyze_bill(request: Request):
    _attempts.check(request.client.host if request.client else 'unknown')
    scheme, _, token = request.headers.get('authorization','').partition(' ')
    if scheme.lower()!='bearer' or not token or len(token)>8192:
        raise HTTPException(401,'Please sign in to analyze bills.')
    if request.headers.get('content-type','').split(';')[0].strip()!='application/json':
        raise HTTPException(415,'Send the saved bill ID as JSON.')
    body=bytearray()
    try:
        async with asyncio.timeout(5):
            async for chunk in request.stream():
                if len(body)+len(chunk)>1024:
                    raise HTTPException(413,'Bill request is too large.')
                body.extend(chunk)
    except TimeoutError:
        raise HTTPException(408,'Bill request timed out.') from None
    try:
        payload=BillRequest.model_validate_json(bytes(body))
    except ValidationError:
        raise HTTPException(422,'Provide a valid bill_id only.') from None
    url=os.getenv('SUPABASE_URL','').rstrip('/')
    key=os.getenv('SUPABASE_PUBLISHABLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    if not url.startswith('https://') or not key:
        raise HTTPException(503,'Bill authentication is not configured.')
    async with httpx.AsyncClient(base_url=url,timeout=15,headers={'apikey':key,'Authorization':'Bearer '+token}) as client:
        user=await authenticated_user(client)
        _users_minute.check(user)
        _users_hour.check(user)
        _global.check('all')
        if _active:
            raise HTTPException(429,'Bill analysis is busy. Please retry shortly.',headers={'Retry-After':'5'})
        _active.add(user)
        try:
            try:
                data,mime=await asyncio.wait_for(owned_bill(client,user,payload.bill_id),timeout=30)
            except TimeoutError:
                raise HTTPException(504,'Bill retrieval timed out.') from None
            try:
                await asyncio.to_thread(documents.document_images,data,mime)
            except documents.InvalidDocument as error:
                raise HTTPException(400,str(error)) from None
            except documents.OCRUnavailable:
                raise HTTPException(503,'Bill document validation is unavailable.') from None
            try:
                result=await asyncio.wait_for(analyze(data,mime),timeout=30)
                if not safe_analysis(result):
                    raise ValueError()
                result['requires_human_verification']=True
            except TimeoutError:
                raise HTTPException(504,'Bill analysis timed out. Try later.') from None
            except Exception:
                raise HTTPException(503,'Bill analysis is unavailable. Please try later.') from None
            try:
                response=await client.patch('/rest/v1/patient_bills',params={
                    'id':f'eq.{payload.bill_id}','patient_id':f'eq.{user}',
                },headers={'Prefer':'return=representation'},json={
                    'analysis_result':result,'analysis_status':'analyzed','verification_status':'analyzed',
                })
                response.raise_for_status()
                if not response.json():
                    raise ValueError()
            except Exception:
                raise HTTPException(503,'Bill analysis could not be saved safely.') from None
            return {'status':'success','message':'Pharmacy bill analyzed successfully.',
                    'requires_human_verification':True,'data':result}
        finally:
            _active.discard(user)
