"""Bound JSON before FastAPI/Pydantic buffering, including unauthenticated requests."""
import asyncio

class JsonBodyLimit:
    limits={'/analyze-prescription':1024,'/ask-medicine':8192}
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        limit=self.limits.get(scope.get('path'))
        if scope['type']!='http' or scope.get('method')!='POST' or limit is None:
            return await self.app(scope,receive,send)
        async def reject(status,message):
            payload=('{"detail":"'+message+'"}').encode()
            await send({'type':'http.response.start','status':status,'headers':[(b'content-type',b'application/json')]})
            await send({'type':'http.response.body','body':payload})
        headers=dict(scope.get('headers',[]))
        if b'content-length' in headers:
            try:length=int(headers[b'content-length'])
            except ValueError:return await reject(400,'Invalid request length.')
            if length<0:return await reject(400,'Invalid request length.')
            if length>limit:return await reject(413,'Request body is too large.')
        body=bytearray()
        try:
            async with asyncio.timeout(5):
                while True:
                    message=await receive()
                    if message['type']=='http.disconnect':return
                    chunk=message.get('body',b'')
                    if len(body)+len(chunk)>limit:return await reject(413,'Request body is too large.')
                    body.extend(chunk)
                    if not message.get('more_body',False):break
        except TimeoutError:return await reject(408,'Request body timed out.')
        delivered=False
        async def replay():
            nonlocal delivered
            if delivered:return {'type':'http.disconnect'}
            delivered=True
            return {'type':'http.request','body':bytes(body),'more_body':False}
        await self.app(scope,replay,send)
